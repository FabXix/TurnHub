import request from "supertest";
import app from "../src/app";
import { storeRepository } from "../src/repositories/store.repository";
import { bearer, OPERATOR_ID, OWNER_ID } from "./helpers/auth";

jest.mock("../src/repositories/store.repository");

const mockedRepo = jest.mocked(storeRepository);
const ADMIN = bearer("admin", OWNER_ID);

const validStore = {
  name: "Barbería El Corte",
  description: "Cortes y barba",
  address: "Av. Vallarta 123, Guadalajara",
  phone: "3312345678",
  email: "contacto@elcorte.com",
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe("POST /api/stores", () => {
  it("registra una empresa con su dueño y devuelve 201 con su id", async () => {
    mockedRepo.findByName.mockResolvedValue(null as any);
    mockedRepo.create.mockImplementation(
      async (data) => ({ _id: "665f1c2e8b3a4d0012345678", ...data }) as any
    );

    const res = await request(app).post("/api/stores").set("Authorization", ADMIN).send(validStore);

    expect(res.status).toBe(201);
    expect(res.body._id).toBeDefined();
    expect(res.body.name).toBe("Barbería El Corte");
    expect(mockedRepo.create).toHaveBeenCalledWith({ ...validStore, ownerId: OWNER_ID });
  });

  it("devuelve 401 si no se envía token", async () => {
    const res = await request(app).post("/api/stores").send(validStore);

    expect(res.status).toBe(401);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it("devuelve 401 si el token es inválido", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", "Bearer token-falso")
      .send(validStore);

    expect(res.status).toBe(401);
  });

  it("devuelve 403 si un operador intenta registrar una empresa", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", bearer("operator", OPERATOR_ID, "665f1c2e8b3a4d0012345678"))
      .send(validStore);

    expect(res.status).toBe(403);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it("devuelve 400 si faltan campos obligatorios (RN-01)", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", ADMIN)
      .send({ name: "Solo nombre" });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["description", "address", "phone", "email"]));
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });

  it("devuelve 400 si el correo es inválido (RN-02)", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", ADMIN)
      .send({ ...validStore, email: "no-es-correo" });

    expect(res.status).toBe(400);
  });

  it("devuelve 400 si el teléfono no tiene 10 dígitos (RN-03)", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", ADMIN)
      .send({ ...validStore, phone: "33 1234" });

    expect(res.status).toBe(400);
  });

  it("devuelve 400 si el JSON está mal formado", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("Authorization", ADMIN)
      .set("Content-Type", "application/json")
      .send("{ mal json");

    expect(res.status).toBe(400);
  });

  it("devuelve 409 si el nombre ya existe (RN-04)", async () => {
    mockedRepo.findByName.mockResolvedValue({ name: validStore.name } as any);

    const res = await request(app).post("/api/stores").set("Authorization", ADMIN).send(validStore);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/empresa/);
    expect(mockedRepo.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/stores (público)", () => {
  it("lista las tiendas sin token", async () => {
    mockedRepo.findAll.mockResolvedValue([] as any);

    const res = await request(app).get("/api/stores");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
