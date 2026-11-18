import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { env } from "../config/env";
import { USER_ROLES, UserRole } from "../models/user.model";
import { storeRepository } from "../repositories/store.repository";
import { userRepository } from "../repositories/user.repository";
import { AppError, AuthPayload, LoginInput, RegisterUserInput } from "../types/type";

const SALT_ROUNDS = 10;

interface UserLike {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  storeId?: unknown;
}

function toPublicUser(user: UserLike) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    storeId: user.storeId ? String(user.storeId) : null,
  };
}

function signToken(user: UserLike): string {
  const payload: AuthPayload = {
    sub: String(user._id),
    role: user.role as UserRole,
    storeId: user.storeId ? String(user.storeId) : null,
  };
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

async function ensureEmailAvailable(email: string) {
  if (await userRepository.findByEmail(email)) {
    throw new AppError(409, "Ya existe una cuenta con ese correo");
  }
}

export const authService = {
  signToken,

  // Crea la cuenta de un administrador (dueño de negocio).
  async register(input: RegisterUserInput) {
    await ensureEmailAvailable(input.email);
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: USER_ROLES.ADMIN,
    });
    return { user: toPublicUser(user), token: signToken(user) };
  },

  async login(input: LoginInput) {
    const user = await userRepository.findByEmailWithPassword(input.email);
    const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new AppError(401, "Correo o contraseña incorrectos");
    }
    return { user: toPublicUser(user), token: signToken(user) };
  },

  async me(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError(401, "La cuenta ya no existe");
    }
    return toPublicUser(user);
  },

  // Un administrador da de alta a un recepcionista para una de sus tiendas.
  async createOperator(storeId: string, input: RegisterUserInput) {
    await ensureEmailAvailable(input.email);
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: USER_ROLES.OPERATOR,
      storeId,
    });
    return toPublicUser(user);
  },

  verifyToken(token: string): AuthPayload {
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      if (typeof decoded === "string" || !decoded.sub || !decoded.role) {
        throw new Error("payload inválido");
      }
      return decoded as unknown as AuthPayload;
    } catch {
      throw new AppError(401, "Token inválido o expirado");
    }
  },

  // Propiedad de tienda: el admin solo gestiona sus tiendas y el operador solo la suya.
  async assertCanManageStore(auth: AuthPayload, storeId: string) {
    if (!isValidObjectId(storeId)) {
      throw new AppError(400, "Identificador de empresa inválido");
    }
    const store = await storeRepository.findById(storeId);
    if (!store) {
      throw new AppError(404, "Empresa no encontrada");
    }

    const allowed =
      auth.role === USER_ROLES.ADMIN
        ? String(store.ownerId) === auth.sub
        : auth.role === USER_ROLES.OPERATOR && auth.storeId === storeId;

    if (!allowed) {
      throw new AppError(403, "No tienes permiso para gestionar esta tienda");
    }
  },
};
