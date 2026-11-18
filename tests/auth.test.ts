import bcrypt from "bcryptjs";
import request from "supertest";
import app from "../src/app";
import { userRepository } from "../src/repositories/user.repository";
import { storeRepository } from "../src/repositories/store.repository";
import { bearer, OTHER_ADMIN_ID, OWNER_ID } from "./helpers/auth";

jest.mock("../src/repositories/user.repository");
jest.mock("../src/repositories/store.repository");

const mockedUsers = jest.mocked(userRepository);
const mockedStores = jest.mocked(storeRepository);

const storeId = "665f1c2e8b3a4d0012345678";

beforeEach(() => {
  jest.resetAllMocks();
});

describe("Autenticación", () => {
  it("registra un administrador y devuelve un token sin exponer la contraseña", async () => {
    mockedUsers.findByEmail.mockResolvedValue(null);
    mockedUsers.create.mockImplementation(
      async (data) => ({ _id: OWNER_ID, ...data, storeId: null }) as any
    );

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ana", email: "Ana@Correo.com", password: "secreta123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: OWNER_ID,
      name: "Ana",
      email: "ana@correo.com",
      role: "admin",
      storeId: null,
    });
    const saved = mockedUsers.create.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe("secreta123");
  });

  it("devuelve 409 si el correo ya está registrado", async () => {
    mockedUsers.findByEmail.mockResolvedValue({ _id: OWNER_ID } as any);

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ana", email: "ana@correo.com", password: "secreta123" });

    expect(res.status).toBe(409);
  });

  it("devuelve 400 si la contraseña es muy corta", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ana", email: "ana@correo.com", password: "123" });

    expect(res.status).toBe(400);
  });

  it("inicia sesión con credenciales correctas", async () => {
    const passwordHash = await bcrypt.hash("secreta123", 4);
    mockedUsers.findByEmailWithPassword.mockResolvedValue({
      _id: OWNER_ID,
      name: "Ana",
      email: "ana@correo.com",
      role: "admin",
      storeId: null,
      passwordHash,
    } as any);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@correo.com", password: "secreta123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("devuelve 401 con contraseña incorrecta", async () => {
    const passwordHash = await bcrypt.hash("secreta123", 4);
    mockedUsers.findByEmailWithPassword.mockResolvedValue({ _id: OWNER_ID, passwordHash } as any);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@correo.com", password: "otra-cosa" });

    expect(res.status).toBe(401);
  });

  it("devuelve 401 en /me sin token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});

describe("Alta de operadores", () => {
  const operator = { name: "Luis", email: "luis@correo.com", password: "recepcion1" };

  it("el dueño de la tienda crea un operador asignado a ella", async () => {
    mockedStores.findById.mockResolvedValue({ _id: storeId, ownerId: OWNER_ID } as any);
    mockedUsers.findByEmail.mockResolvedValue(null);
    mockedUsers.create.mockImplementation(
      async (data) => ({ _id: "665f1c2e8b3a4d00dddddddd", ...data }) as any
    );

    const res = await request(app)
      .post(`/api/stores/${storeId}/operators`)
      .set("Authorization", bearer("admin", OWNER_ID))
      .send(operator);

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("operator");
    expect(res.body.storeId).toBe(storeId);
  });

  it("devuelve 403 si otro admin intenta crear operadores en una tienda ajena", async () => {
    mockedStores.findById.mockResolvedValue({ _id: storeId, ownerId: OWNER_ID } as any);

    const res = await request(app)
      .post(`/api/stores/${storeId}/operators`)
      .set("Authorization", bearer("admin", OTHER_ADMIN_ID))
      .send(operator);

    expect(res.status).toBe(403);
    expect(mockedUsers.create).not.toHaveBeenCalled();
  });
});
