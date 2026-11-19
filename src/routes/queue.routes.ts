import { Router } from "express";
import { z } from "zod";
import { queueController } from "../controllers/queue.controller";
import { validateBody } from "../middlewares/validate";
import { authenticate, authorize, requireStoreAccess } from "../middlewares/auth";
import { TICKET_STATUS } from "../models/ticket.model";
import { USER_ROLES } from "../models/user.model";

// Feature 4: estados a los que se puede mover un turno manualmente.
const MANUAL_STATUSES = [
	TICKET_STATUS.COMPLETED,
	TICKET_STATUS.CANCELLED,
	TICKET_STATUS.NO_SHOW,
] as const;

const updateTicketStatusSchema = z.object({
	status: z.enum(MANUAL_STATUSES, {
		error: `El estado debe ser uno de: ${MANUAL_STATUSES.join(", ")}`,
	}),
});

// Personal autorizado de la tienda: su administrador (dueño) o su operador.
const storeStaff = [
	authenticate,
	authorize(USER_ROLES.ADMIN, USER_ROLES.OPERATOR),
	requireStoreAccess,
];

const router = Router();

// Público (clientes finales)
router.post("/:storeId/queue", queueController.join); // Feature 3
router.get("/:storeId/queue", queueController.getStatus); // Feature 3
router.get("/:storeId/queue/stats", queueController.getStats); // Feature 6
router.get("/:storeId/tickets/:ticketId", queueController.getTicket); // Feature 5

// Protegido (Feature 4)
router.patch("/:storeId/queue/next", ...storeStaff, queueController.callNext);
router.get("/:storeId/tickets", ...storeStaff, queueController.listTickets);
router.patch(
	"/:storeId/tickets/:ticketId",
	...storeStaff,
	validateBody(updateTicketStatusSchema),
	queueController.updateTicketStatus
);

export default router;
