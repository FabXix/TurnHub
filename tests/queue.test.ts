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
		mockedQueueRepository.findLastTicketNumber.mockResolvedValue(4);
		mockedQueueRepository.createTicket.mockResolvedValue({
			_id: "ticket-id",
			storeId,
			ticketNumber: 5,
			status: "en espera",
		} as any);

		const response = await request(app).post(`/api/stores/${storeId}/queue`);

		expect(response.status).toBe(201);
		expect(response.body.ticketNumber).toBe(5);
		expect(mockedQueueRepository.createTicket).toHaveBeenCalledWith(storeId, 5);
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
		});
	});

	it("devuelve 400 para un identificador inválido", async () => {
		const response = await request(app).get("/api/stores/id-invalido/queue");

		expect(response.status).toBe(400);
		expect(mockedStoreRepository.findById).not.toHaveBeenCalled();
	});
});
