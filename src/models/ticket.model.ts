import { InferSchemaType, Model, Schema, model } from "mongoose";

export const TICKET_STATUS = {
	WAITING: "en espera",
	SERVING: "en atención",
	COMPLETED: "completado",
	CANCELLED: "cancelado",
	NO_SHOW: "no se presentó",
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

// Feature 4: transiciones de estado permitidas. Los estados finales no tienen salida.
export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
	[TICKET_STATUS.WAITING]: [TICKET_STATUS.SERVING, TICKET_STATUS.CANCELLED],
	[TICKET_STATUS.SERVING]: [TICKET_STATUS.COMPLETED, TICKET_STATUS.NO_SHOW],
	[TICKET_STATUS.COMPLETED]: [],
	[TICKET_STATUS.CANCELLED]: [],
	[TICKET_STATUS.NO_SHOW]: [],
};

const ticketSchema = new Schema(
	{
		storeId: {
			type: Schema.Types.ObjectId,
			ref: "Store",
			required: true,
		},
		ticketNumber: {
			type: Number,
			required: true,
			min: 1,
		},
		status: {
			type: String,
			enum: Object.values(TICKET_STATUS),
			default: TICKET_STATUS.WAITING,
			required: true,
		},
		calledAt: { type: Date, default: null },
		finishedAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

// Impide que dos solicitudes asignen el mismo turno a una tienda.
ticketSchema.index({ storeId: 1, ticketNumber: 1 }, { unique: true });
// Acelera la búsqueda del siguiente turno en espera / turno en atención.
ticketSchema.index({ storeId: 1, status: 1, ticketNumber: 1 });

export type TicketDocument = InferSchemaType<typeof ticketSchema>;
export const Ticket: Model<TicketDocument> = model<TicketDocument>(
	"Ticket",
	ticketSchema
);
