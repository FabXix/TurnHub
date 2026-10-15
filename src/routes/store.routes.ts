import { Router } from "express";
import { z } from "zod";
import { storeController } from "../controllers/store.controller";
import { validateBody } from "../middlewares/validate";

const createStoreSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  description: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
  address: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, "Teléfono inválido")
    .optional(),
  email: z.string().trim().email("Correo inválido").optional(),
});

const router = Router();

router.post("/", validateBody(createStoreSchema), storeController.create);
router.get("/", storeController.getAll);
router.get("/:id", storeController.getById);

export default router;