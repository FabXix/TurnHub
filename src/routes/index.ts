import { Router } from "express";
import storeRoutes from "./store.routes";
import queueRoutes from "./queue.routes";

const router = Router();

router.use("/stores", storeRoutes);
router.use("/stores", queueRoutes); // Feature 3

export default router;