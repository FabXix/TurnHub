import { Schema, model, InferSchemaType } from "mongoose";

const storeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    // Administrador dueño de la tienda (quien la registró).
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Contador atómico del último número de turno emitido (RN-11, RN-12, RN-13).
    ticketSeq: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

export type StoreDocument = InferSchemaType<typeof storeSchema>;
export const Store = model("Store", storeSchema);
