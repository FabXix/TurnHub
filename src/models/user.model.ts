import { Schema, model, InferSchemaType } from "mongoose";

// admin: dueño del negocio, registra tiendas y operadores y gestiona sus filas.
// operator: recepcionista asignado a una sola tienda, solo gestiona esa fila.
// Los clientes finales no necesitan cuenta (consultan y toman turno de forma pública).
export const USER_ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(USER_ROLES), required: true },
    // Solo para operadores: la tienda donde trabajan.
    storeId: { type: Schema.Types.ObjectId, ref: "Store", default: null },
  },
  { timestamps: true }
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
