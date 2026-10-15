import app from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";

async function start() {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`TurnHub escuchando en http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error("No se pudo iniciar el servidor", err);
  process.exit(1);
});