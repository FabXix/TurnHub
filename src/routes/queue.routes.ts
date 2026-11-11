import { Router } from "express";
import { z } from "zod";
import { queueController } from "../controllers/queue.controller";
import { validateBody } from "../middlewares/validate";
import { TICKET_STATUS } from "../models/ticket.model";

// Feature 4: estados a los que se puede mover un turno manualmente.
const updateTicketStatusSchema = z.object({
	status: z.enum([TICKET_STATUS.COMPLETED, TICKET_STATUS.CANCELLED, TICKET_STATUS.NO_SHOW], {
		error: `El estado debe ser "${TICKET_STATUS.COMPLETED}", "${TICKET_STATUS.CANCELLED}" o "${TICKET_STATUS.NO_SHOW}"`,
	}),
});

const router = Router();

router.post("/:storeId/queue", queueController.join);
router.get("/:storeId/queue", queueController.getStatus);

// Feature 5
router.get("/:storeId/tickets/:ticketId", queueController.getTicket);

// Feature 4
router.patch("/:storeId/queue/next", queueController.callNext);
router.patch(
	"/:storeId/tickets/:ticketId",
	validateBody(updateTicketStatusSchema),
	queueController.updateTicketStatus
);

export default router;
