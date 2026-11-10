import request from "supertest";
import app from "../src/app";
import { queueRepository } from "../src/repositories/queue.repository";
import { storeRepository } from "../src/repositories/store.repository";

jest.mock("../src/repositories/queue.repository");
jest.mock("../src/repositories/store.repository");

const mockedQueueRepository = jest.mocked(queueRepository);
const mockedStoreRepository = jest.mocked(storeRepository);

const storeId = "665f1c2e8b3a4d0012345678";
const ticketId = "665f1c2e8b3a4d0087654321";

beforeEach(() => {
	jest.resetAllMocks();
	mockedStoreRepository.findById.mockResolvedValue({ _id: storeId } as any);
});

describe("Feature 4: atender el siguiente turno", () => {
	it("llama al siguiente turno y finaliza el que estaba en atención", async () => {
		mockedQueueRepository.findServingTicket.mockResolvedValue({
			_id: "prev-id",
			ticketNumber: 1,
			status: "en atención",
		} as any);
		mockedQueueRepository.takeNextWaitingTicket.mockResolvedValue({
			_id: "next-id",
			ticketNumber: 2,
			status: "en atención",
		} as any);
		mockedQueueRepository.updateTicketStatus.mockResolvedValue({
			_id: "prev-id",
			ticketNumber: 1,
			status: "completado",
		} as any);

		const response = await request(app).patch(`/api/stores/${storeId}/queue/next`);

		expect(response.status).toBe(200);
		expect(response.body.currentTicket.ticketNumber).toBe(2);
		expect(response.body.previousTicket.status).toBe("completado");
		expect(mockedQueueRepository.updateTicketStatus).toHaveBeenCalledWith(
			"prev-id",
			"en atención",
			"completado"
		);
	});

	it("llama al primer turno cuando nadie está en atención", async () => {
		mockedQueueRepository.findServingTicket.mockResolvedValue(null);
		mockedQueueRepository.takeNextWaitingTicket.mockResolvedValue({
			_id: "next-id",
			ticketNumber: 1,
			status: "en atención",
		} as any);

		const response = await request(app).patch(`/api/stores/${storeId}/queue/next`);

		expect(response.status).toBe(200);
		expect(response.body.previousTicket).toBeNull();
		expect(mockedQueueRepository.updateTicketStatus).not.toHaveBeenCalled();
	});

	it("devuelve 404 si no hay turnos en espera y no finaliza el turno actual", async () => {
		mockedQueueRepository.findServingTicket.mockResolvedValue({
			_id: "prev-id",
			ticketNumber: 3,
			status: "en atención",
		} as any);
		mockedQueueRepository.takeNextWaitingTicket.mockResolvedValue(null);

		const response = await request(app).patch(`/api/stores/${storeId}/queue/next`);

		expect(response.status).toBe(404);
		expect(mockedQueueRepository.updateTicketStatus).not.toHaveBeenCalled();
	});

	it("devuelve 404 si la tienda no existe", async () => {
		mockedStoreRepository.findById.mockResolvedValue(null);

		const response = await request(app).patch(`/api/stores/${storeId}/queue/next`);

		expect(response.status).toBe(404);
		expect(mockedQueueRepository.takeNextWaitingTicket).not.toHaveBeenCalled();
	});
});

describe("Feature 4: cambiar el estado de un turno", () => {
	it("cancela un turno en espera", async () => {
		mockedQueueRepository.findTicketInStore.mockResolvedValue({
			_id: ticketId,
			status: "en espera",
		} as any);
		mockedQueueRepository.updateTicketStatus.mockResolvedValue({
			_id: ticketId,
			status: "cancelado",
		} as any);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.send({ status: "cancelado" });

		expect(response.status).toBe(200);
		expect(response.body.status).toBe("cancelado");
		expect(mockedQueueRepository.updateTicketStatus).toHaveBeenCalledWith(
			ticketId,
			"en espera",
			"cancelado"
		);
	});

	it("devuelve 409 para una transición no permitida", async () => {
		mockedQueueRepository.findTicketInStore.mockResolvedValue({
			_id: ticketId,
			status: "cancelado",
		} as any);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.send({ status: "completado" });

		expect(response.status).toBe(409);
		expect(mockedQueueRepository.updateTicketStatus).not.toHaveBeenCalled();
	});

	it("devuelve 400 si el estado no es válido", async () => {
		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.send({ status: "en espera" });

		expect(response.status).toBe(400);
	});

	it("devuelve 400 para un identificador de turno inválido", async () => {
		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/id-invalido`)
			.send({ status: "completado" });

		expect(response.status).toBe(400);
	});

	it("devuelve 404 si el turno no existe en esa tienda", async () => {
		mockedQueueRepository.findTicketInStore.mockResolvedValue(null);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.send({ status: "completado" });

		expect(response.status).toBe(404);
	});
});
