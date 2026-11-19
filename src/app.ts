import path from "path";
import express from "express";
import cors from "cors";
import routes from "./routes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

// Interfaz web (SPA en /public). Desde la raíz del proyecto, para que funcione igual con
// `npm run dev` y con el build.
app.use(express.static(path.resolve(process.cwd(), "public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", routes);

app.use(errorHandler);

export default app;
