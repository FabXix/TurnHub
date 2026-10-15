import request from "supertest";
import app from "../src/app";
import { storeRepository } from "../src/repositories/store.repository";

jest.mock("../src/repositories/store.repository");

const mockedRepo = jest.mocked(storeRepository);

beforeEach(() => {
  jest.resetAllMocks();
});

describe("POST /api/stores", () => {
  it("registra una empresa y devuelve 201 con su id", async () => {
    mockedRepo.findByName.mockResolvedValue(null as any);
    mockedRepo.create.mockImplementation(
      async (data) => ({ _id: "665f1c2e8b3a4d0012345678", ...data }) as any
    );

    const res = await request(app)
      .post("/api/stores")
      .send({ name: "Barbería El Corte", description: "Cortes y barba", phone: "33 1234 5678" });

    expect(res.status).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.name).toBe("Barbería El Corte");
    expect(mockedRepo.create).toHaveBeenCalledTimes(1);
  });

  it("devuelve 400 si falta el nombre", async () => {
    const res = await request(app).post("/api/stores").send({ description: "sin nombre" });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("name");
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el correo es inválido", async () => {
    const res = await request(app)
      .post("/api/stores")
      .send({ name: "Tienda", email: "no-es-correo" });

    expect(res.status).toBe(400);
  });

  it("devuelve 400 si el JSON está mal formado", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("Content-Type", "application/json")
      .send("{ mal json");

    expect(res.status).toBe(400);
  });

  it("devuelve 409 si el nombre ya existe", async () => {
    mockedRepo.findByName.mockResolvedValue({ name: "Repetida" } as any);

    const res = await request(app).post("/api/stores").send({ name: "Repetida" });

    expect(res.status).toBe(409);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });
});