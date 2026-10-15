import { InferSchemaType, Model, Schema, model } from "mongoose";

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
			enum: ["en espera"],
			default: "en espera",
			required: true,
		},
	},
	{ timestamps: true }
);

// Impide que dos solicitudes asignen el mismo turno a una tienda.
ticketSchema.index({ storeId: 1, ticketNumber: 1 }, { unique: true });

export type TicketDocument = InferSchemaType<typeof ticketSchema>;
export const Ticket: Model<TicketDocument> = model<TicketDocument>(
	"Ticket",
	ticketSchema
);