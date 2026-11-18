import { Router } from "express";
import authRoutes from "./auth.routes";
import storeRoutes from "./store.routes";
import queueRoutes from "./queue.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/stores", storeRoutes);
router.use("/stores", queueRoutes);

export default router;
