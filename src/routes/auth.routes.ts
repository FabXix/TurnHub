import { Router } from "express";
import { z } from "zod";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth";
import { validateBody } from "../middlewares/validate";

export const registerUserSchema = z.object({
  name: z
    .string({ error: "El nombre es obligatorio" })
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  email: z.string({ error: "El correo es obligatorio" }).trim().toLowerCase().email("Correo inválido"),
  password: z
    .string({ error: "La contraseña es obligatoria" })
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña no puede exceder 72 caracteres"),
});

const loginSchema = z.object({
  email: z.string({ error: "El correo es obligatorio" }).trim().toLowerCase().email("Correo inválido"),
  password: z.string({ error: "La contraseña es obligatoria" }).min(1, "La contraseña es obligatoria"),
});

const router = Router();

router.post("/register", validateBody(registerUserSchema), authController.register);
router.post("/login", validateBody(loginSchema), authController.login);
router.get("/me", authenticate, authController.me);

export default router;
