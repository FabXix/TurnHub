import mongoose from "mongoose";
import { env } from "./env";

export async function connectDatabase(uri: string = env.mongoUri): Promise<void> {
  await mongoose.connect(uri);
  console.log("MongoDB conectado");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}