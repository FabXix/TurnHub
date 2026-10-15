import { Router } from "express";
import { queueController } from "../controllers/queue.controller";

const router = Router();

router.post("/:storeId/queue", queueController.join);
router.get("/:storeId/queue", queueController.getStatus);

export default router;