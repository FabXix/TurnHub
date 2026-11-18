import path from "path";
import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  // Desde la raíz del proyecto, para que funcione igual con `npm run dev` y con el build.
  res.sendFile(path.resolve(process.cwd(), "index.html"));
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", routes);

app.use(errorHandler);

export default app;