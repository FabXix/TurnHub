import request from "supertest";
import app from "../src/app";
import { queueRepository } from "../src/repositories/queue.repository";
import { storeRepository } from "../src/repositories/store.repository";
import { AppError } from "../src/types/type";
import { bearer, OPERATOR_ID, OTHER_ADMIN_ID, OWNER_ID } from "./helpers/auth";

jest.mock("../src/repositories/queue.repository");
jest.mock("../src/repositories/store.repository");

const mockedQueueRepository = jest.mocked(queueRepository);
const mockedStoreRepository = jest.mocked(storeRepository);

const storeId = "665f1c2e8b3a4d0012345678";
const otherStoreId = "665f1c2e8b3a4d0099999999";
const ticketId = "665f1c2e8b3a4d0087654321";

const OWNER = bearer("admin", OWNER_ID);
const OTHER_ADMIN = bearer("admin", OTHER_ADMIN_ID);
const OPERATOR = bearer("operator", OPERATOR_ID, storeId);
const OTHER_OPERATOR = bearer("operator", OPERATOR_ID, otherStoreId);

beforeEach(() => {
	jest.resetAllMocks();
	mockedStoreRepository.findById.mockResolvedValue({ _id: storeId, ownerId: OWNER_ID } as any);
});

describe("Feature 4: seguridad de las operaciones de atención", () => {
	it("devuelve 401 al llamar al siguiente turno sin token", async () => {
		const response = await request(app).patch(`/api/stores/${storeId}/queue/next`);

		expect(response.status).toBe(401);
		expect(mockedQueueRepository.advanceQueue).not.toHaveBeenCalled();
	});

	it("devuelve 403 si un admin intenta avanzar la fila de una tienda que no es suya", async () => {
		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OTHER_ADMIN);

		expect(response.status).toBe(403);
		expect(mockedQueueRepository.advanceQueue).not.toHaveBeenCalled();
	});

	it("devuelve 403 si un operador intenta gestionar otra tienda", async () => {
		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.set("Authorization", OTHER_OPERATOR)
			.send({ status: "cancelled" });

		expect(response.status).toBe(403);
		expect(mockedQueueRepository.updateTicketStatus).not.toHaveBeenCalled();
	});

	it("permite al operador asignado avanzar la fila de su tienda", async () => {
		mockedQueueRepository.advanceQueue.mockResolvedValue({
			previousTicket: null,
			currentTicket: { ticketNumber: 1, status: "serving" },
		});

		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OPERATOR);

		expect(response.status).toBe(200);
	});

	it("devuelve 401 al cambiar el estado de un turno sin token", async () => {
		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.send({ status: "cancelled" });

		expect(response.status).toBe(401);
	});
});

describe("Feature 4: atender el siguiente turno", () => {
	it("llama al siguiente turno y finaliza el que estaba en atención", async () => {
		mockedQueueRepository.advanceQueue.mockResolvedValue({
			previousTicket: { _id: "prev-id", ticketNumber: 1, status: "completed" },
			currentTicket: { _id: "next-id", ticketNumber: 2, status: "serving" },
		});

		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OWNER);

		expect(response.status).toBe(200);
		expect(response.body.currentTicket.ticketNumber).toBe(2);
		expect(response.body.previousTicket.status).toBe("completed");
		expect(mockedQueueRepository.advanceQueue).toHaveBeenCalledWith(storeId);
	});

	it("llama al primer turno cuando nadie está en atención", async () => {
		mockedQueueRepository.advanceQueue.mockResolvedValue({
			previousTicket: null,
			currentTicket: { _id: "next-id", ticketNumber: 1, status: "serving" },
		});

		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OWNER);

		expect(response.status).toBe(200);
		expect(response.body.previousTicket).toBeNull();
	});

	it("devuelve 404 si no hay turnos en espera", async () => {
		mockedQueueRepository.advanceQueue.mockResolvedValue(null);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OWNER);

		expect(response.status).toBe(404);
	});

	it("devuelve 409 y no reporta éxito si la transacción se aborta", async () => {
		mockedQueueRepository.advanceQueue.mockRejectedValue(
			new AppError(409, "La fila cambió mientras se avanzaba, intenta de nuevo")
		);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OWNER);

		expect(response.status).toBe(409);
		expect(response.body.currentTicket).toBeUndefined();
	});

	it("devuelve 409 con mensaje de la fila si choca el índice de un solo turno en atención", async () => {
		mockedQueueRepository.advanceQueue.mockRejectedValue(
			Object.assign(new Error("E11000"), { code: 11000, keyPattern: { storeId: 1 } })
		);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OWNER);

		expect(response.status).toBe(409);
		expect(response.body.error).toMatch(/turno en atención/);
	});

	it("devuelve 404 si la tienda no existe", async () => {
		mockedStoreRepository.findById.mockResolvedValue(null);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/queue/next`)
			.set("Authorization", OWNER);

		expect(response.status).toBe(404);
		expect(mockedQueueRepository.advanceQueue).not.toHaveBeenCalled();
	});
});

describe("Feature 4: cambiar el estado de un turno", () => {
	it("cancela un turno en espera", async () => {
		mockedQueueRepository.findTicketInStore.mockResolvedValue({
			_id: ticketId,
			status: "waiting",
		} as any);
		mockedQueueRepository.updateTicketStatus.mockResolvedValue({
			_id: ticketId,
			status: "cancelled",
		} as any);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.set("Authorization", OWNER)
			.send({ status: "cancelled" });

		expect(response.status).toBe(200);
		expect(response.body.status).toBe("cancelled");
		expect(mockedQueueRepository.updateTicketStatus).toHaveBeenCalledWith(
			ticketId,
			"waiting",
			"cancelled"
		);
	});

	it("devuelve 409 para una transición no permitida", async () => {
		mockedQueueRepository.findTicketInStore.mockResolvedValue({
			_id: ticketId,
			status: "cancelled",
		} as any);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.set("Authorization", OWNER)
			.send({ status: "completed" });

		expect(response.status).toBe(409);
		expect(mockedQueueRepository.updateTicketStatus).not.toHaveBeenCalled();
	});

	it("devuelve 400 si el estado no es un valor permitido", async () => {
		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.set("Authorization", OWNER)
			.send({ status: "cancelado" });

		expect(response.status).toBe(400);
	});

	it("devuelve 400 para un identificador de turno inválido", async () => {
		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/id-invalido`)
			.set("Authorization", OWNER)
			.send({ status: "completed" });

		expect(response.status).toBe(400);
	});

	it("devuelve 404 si el turno no existe en esa tienda", async () => {
		mockedQueueRepository.findTicketInStore.mockResolvedValue(null);

		const response = await request(app)
			.patch(`/api/stores/${storeId}/tickets/${ticketId}`)
			.set("Authorization", OWNER)
			.send({ status: "completed" });

		expect(response.status).toBe(404);
	});
});

describe("Feature 4: lista de turnos para el personal", () => {
	it("devuelve 401 sin token", async () => {
		const response = await request(app).get(`/api/stores/${storeId}/tickets`);

		expect(response.status).toBe(401);
		expect(mockedQueueRepository.listTickets).not.toHaveBeenCalled();
	});

	it("devuelve 403 si el operador es de otra tienda", async () => {
		const response = await request(app)
			.get(`/api/stores/${storeId}/tickets`)
			.set("Authorization", OTHER_OPERATOR);

		expect(response.status).toBe(403);
	});

	it("lista los turnos filtrados por estado con su etiqueta", async () => {
		mockedQueueRepository.listTickets.mockResolvedValue([
			{ _id: "a", ticketNumber: 3, status: "serving" },
			{ _id: "b", ticketNumber: 4, status: "waiting" },
		] as any);

		const response = await request(app)
			.get(`/api/stores/${storeId}/tickets?status=waiting,serving`)
			.set("Authorization", OWNER);

		expect(response.status).toBe(200);
		expect(mockedQueueRepository.listTickets).toHaveBeenCalledWith(storeId, ["waiting", "serving"], 200);
		expect(response.body).toEqual([
			expect.objectContaining({ ticketNumber: 3, statusLabel: "En atención" }),
			expect.objectContaining({ ticketNumber: 4, statusLabel: "En espera" }),
		]);
	});

	it("devuelve 400 con un estado inválido", async () => {
		const response = await request(app)
			.get(`/api/stores/${storeId}/tickets?status=foo`)
			.set("Authorization", OPERATOR);

		expect(response.status).toBe(400);
		expect(mockedQueueRepository.listTickets).not.toHaveBeenCalled();
	});
});
