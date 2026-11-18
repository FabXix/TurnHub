import { Router } from "express";
import { z } from "zod";
import { storeController } from "../controllers/store.controller";
import { authController } from "../controllers/auth.controller";
import { validateBody } from "../middlewares/validate";
import { authenticate, authorize, requireStoreAccess } from "../middlewares/auth";
import { USER_ROLES } from "../models/user.model";
import { registerUserSchema } from "./auth.routes";

// RN-01 a RN-03: todos los campos son obligatorios y se validan antes de guardar.
const createStoreSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  description: z
    .string({ error: "La descripción es obligatoria" })
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(500, "Máximo 500 caracteres"),
  address: z
    .string({ error: "La dirección es obligatoria" })
    .trim()
    .min(1, "La dirección es obligatoria")
    .max(200, "Máximo 200 caracteres"),
  phone: z
    .string({ error: "El teléfono es obligatorio" })
    .trim()
    .regex(/^\d{10}$/, "El teléfono debe tener exactamente 10 dígitos"),
  email: z.string({ error: "El correo es obligatorio" }).trim().email("Correo inválido"),
});

const router = Router();

// Público
router.get("/", storeController.getAll);
router.get("/:id", storeController.getById);

// Solo administradores (dueños de negocio)
router.post(
  "/",
  authenticate,
  authorize(USER_ROLES.ADMIN),
  validateBody(createStoreSchema),
  storeController.create
);
router.post(
  "/:storeId/operators",
  authenticate,
  authorize(USER_ROLES.ADMIN),
  requireStoreAccess,
  validateBody(registerUserSchema),
  authController.createOperator
);

export default router;
