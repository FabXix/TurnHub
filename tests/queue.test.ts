import request from "supertest";
import app from "../src/app";
import { queueRepository } from "../src/repositories/queue.repository";
import { storeRepository } from "../src/repositories/store.repository";

jest.mock("../src/repositories/queue.repository");
jest.mock("../src/repositories/store.repository");

const mockedQueueRepository = jest.mocked(queueRepository);
const mockedStoreRepository = jest.mocked(storeRepository);

const storeId = "665f1c2e8b3a4d0012345678";

beforeEach(() => {
	jest.resetAllMocks();
});

describe("Feature 3: cola de una tienda", () => {
	it("crea un turno consecutivo y devuelve 201", async () => {
		mockedStoreRepository.findById.mockResolvedValue({ _id: storeId } as any);
		mockedStoreRepository.nextTicketNumber.mockResolvedValue(5);
		mockedQueueRepository.createTicket.mockResolvedValue({
			_id: "ticket-id",
			storeId,
			ticketNumber: 5,
			status: "waiting",
		} as any);

		const response = await request(app).post(`/api/stores/${storeId}/queue`);

		expect(response.status).toBe(201);
		expect(response.body.ticketNumber).toBe(5);
		expect(mockedQueueRepository.createTicket).toHaveBeenCalledWith(storeId, 5);
	});

	describe("Feature 6: estadísticas de la cola", () => {
		it("devuelve null para el promedio y la espera estimada si no hay turnos completados", async () => {
			mockedStoreRepository.findById.mockResolvedValue({ _id: storeId } as any);
			mockedQueueRepository.getQueueStats.mockResolvedValue({
				waitingCount: 0,
				currentlyServing: null,
				completedCount: 0,
				cancelledCount: 0,
				noShowCount: 0,
				averageServiceMinutes: null,
			});

			const response = await request(app).get(`/api/stores/${storeId}/queue/stats`);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				storeId,
				waitingCount: 0,
				currentlyServing: null,
				completedCount: 0,
				cancelledCount: 0,
				noShowCount: 0,
				averageServiceMinutes: null,
				estimatedWaitMinutes: null,
			});
		});

		it("redondea el promedio y calcula la espera estimada con los conteos de la tienda", async () => {
			mockedStoreRepository.findById.mockResolvedValue({ _id: storeId } as any);
			mockedQueueRepository.getQueueStats.mockResolvedValue({
				waitingCount: 3,
				currentlyServing: 7,
				completedCount: 25,
				cancelledCount: 2,
				noShowCount: 1,
				averageServiceMinutes: 4.126,
			});

			const response = await request(app).get(`/api/stores/${storeId}/queue/stats`);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				storeId,
				waitingCount: 3,
				currentlyServing: 7,
				completedCount: 25,
				cancelledCount: 2,
				noShowCount: 1,
				averageServiceMinutes: 4.13,
				estimatedWaitMinutes: 13,
			});
			expect(mockedQueueRepository.getQueueStats).toHaveBeenCalledWith(storeId);
		});

		it("devuelve 400 para un storeId inválido", async () => {
			const response = await request(app).get("/api/stores/id-invalido/queue/stats");

			expect(response.status).toBe(400);
			expect(mockedStoreRepository.findById).not.toHaveBeenCalled();
			expect(mockedQueueRepository.getQueueStats).not.toHaveBeenCalled();
		});

		it("devuelve 404 si la tienda no existe", async () => {
			mockedStoreRepository.findById.mockResolvedValue(null);

			const response = await request(app).get(`/api/stores/${storeId}/queue/stats`);

			expect(response.status).toBe(404);
			expect(mockedQueueRepository.getQueueStats).not.toHaveBeenCalled();
		});
	});

	it("devuelve 404 si la tienda no existe", async () => {
		mockedStoreRepository.findById.mockResolvedValue(null);

		const response = await request(app).post(`/api/stores/${storeId}/queue`);

		expect(response.status).toBe(404);
		expect(mockedQueueRepository.createTicket).not.toHaveBeenCalled();
	});

	it("consulta el último turno y la cantidad de turnos en espera", async () => {
		mockedStoreRepository.findById.mockResolvedValue({ _id: storeId } as any);
		mockedQueueRepository.findLastTicketNumber.mockResolvedValue(8);
		mockedQueueRepository.countWaitingTickets.mockResolvedValue(3);

		const response = await request(app).get(`/api/stores/${storeId}/queue`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			storeId,
			lastTicketNumber: 8,
			waitingCount: 3,
			currentTicketNumber: null,
		});
	});

	it("devuelve 503 si se agotan los reintentos por colisión de número de turno", async () => {
		mockedStoreRepository.findById.mockResolvedValue({ _id: storeId } as any);
		mockedStoreRepository.nextTicketNumber.mockResolvedValue(5);
		mockedQueueRepository.findLastTicketNumber.mockResolvedValue(9);
		mockedQueueRepository.createTicket.mockRejectedValue(
			Object.assign(new Error("E11000"), { code: 11000, keyPattern: { storeId: 1, ticketNumber: 1 } })
		);

		const response = await request(app).post(`/api/stores/${storeId}/queue`);

		expect(response.status).toBe(503);
		expect(response.body.error).not.toMatch(/empresa/);
		expect(mockedQueueRepository.createTicket).toHaveBeenCalledTimes(5);
	});

	it("sincroniza el contador con el último turno real y reintenta si el número ya existía", async () => {
		mockedStoreRepository.findById.mockResolvedValue({ _id: storeId } as any);
		mockedStoreRepository.nextTicketNumber.mockResolvedValueOnce(1).mockResolvedValueOnce(6);
		mockedQueueRepository.findLastTicketNumber.mockResolvedValue(5);
		mockedQueueRepository.createTicket
			.mockRejectedValueOnce(Object.assign(new Error("E11000"), { code: 11000 }))
			.mockResolvedValueOnce({ ticketNumber: 6, status: "waiting" } as any);

		const response = await request(app).post(`/api/stores/${storeId}/queue`);

		expect(response.status).toBe(201);
		expect(response.body.ticketNumber).toBe(6);
		expect(mockedStoreRepository.syncTicketSeq).toHaveBeenCalledWith(storeId, 5);
	});

	it("devuelve 400 para un identificador inválido", async () => {
		const response = await request(app).get("/api/stores/id-invalido/queue");

		expect(response.status).toBe(400);
		expect(mockedStoreRepository.findById).not.toHaveBeenCalled();
	});
});
