import { InferSchemaType, Model, Schema, model } from "mongoose";

// Valores de máquina estables que viajan en la API y se guardan en MongoDB.
export const TICKET_STATUS = {
	WAITING: "waiting",
	SERVING: "serving",
	COMPLETED: "completed",
	CANCELLED: "cancelled",
	NO_SHOW: "no_show",
} as const;

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS];

// Etiquetas en español para mostrar en la interfaz (no forman parte del contrato).
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
	[TICKET_STATUS.WAITING]: "En espera",
	[TICKET_STATUS.SERVING]: "En atención",
	[TICKET_STATUS.COMPLETED]: "Completado",
	[TICKET_STATUS.CANCELLED]: "Cancelado",
	[TICKET_STATUS.NO_SHOW]: "No se presentó",
};

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

// RN-13: impide que dos solicitudes asignen el mismo turno a una tienda.
ticketSchema.index({ storeId: 1, ticketNumber: 1 }, { unique: true, name: "unique_ticket_number_per_store" });
// Acelera la búsqueda del siguiente turno en espera / turno en atención.
ticketSchema.index({ storeId: 1, status: 1, ticketNumber: 1 });
// RN-19: a nivel base de datos, solo puede existir un turno "serving" por tienda.
ticketSchema.index(
	{ storeId: 1 },
	{
		unique: true,
		name: "unique_serving_per_store",
		partialFilterExpression: { status: TICKET_STATUS.SERVING },
	}
);

export type TicketDocument = InferSchemaType<typeof ticketSchema>;
export const Ticket: Model<TicketDocument> = model<TicketDocument>(
	"Ticket",
	ticketSchema
);
