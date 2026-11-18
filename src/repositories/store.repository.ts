import { Store } from "../models/store.model";
import { CreateStoreInput } from "../types/type";

export const storeRepository = {
  create(data: CreateStoreInput & { ownerId: string }) {
    return Store.create(data);
  },

  findAll() {
    return Store.find().sort({ createdAt: -1 });
  },

  findById(id: string) {
    return Store.findById(id);
  },

  // Incrementa de forma atómica el contador de turnos de la tienda y regresa el nuevo número.
  // Devuelve null si la tienda no existe.
  async nextTicketNumber(id: string): Promise<number | null> {
    const store = await Store.findByIdAndUpdate(
      id,
      { $inc: { ticketSeq: 1 } },
      { returnDocument: "after", projection: { ticketSeq: 1 } }
    ).lean();
    return store ? (store.ticketSeq as number) : null;
  },

  // Alinea el contador con el último turno real (tiendas creadas antes de existir el contador).
  syncTicketSeq(id: string, lastTicketNumber: number) {
    return Store.updateOne({ _id: id }, { $max: { ticketSeq: lastTicketNumber } });
  },

  findByName(name: string) {
    return Store.findOne({ name });
  },
};
