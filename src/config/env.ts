import dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

if (nodeEnv === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET es obligatorio en producción");
}

export const env = {
  port: Number(process.env.PORT) || 3000,
  mongoUri:
    process.env.MONGODB_URI ||
    "mongodb://localhost:27017/turnhub?replicaSet=rs0&directConnection=true",
  nodeEnv,
  jwtSecret: process.env.JWT_SECRET || "turnhub-dev-secret-cambiar",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
};
