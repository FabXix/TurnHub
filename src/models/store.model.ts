import { Schema, model, InferSchemaType } from "mongoose";

const storeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
  },
  { timestamps: true }
);

export type StoreDocument = InferSchemaType<typeof storeSchema>;
export const Store = model("Store", storeSchema);