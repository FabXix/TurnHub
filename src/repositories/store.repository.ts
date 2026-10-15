import { Store } from "../models/store.model";
import { CreateStoreInput } from "../types/type";

export const storeRepository = {
  create(data: CreateStoreInput) {
    return Store.create(data);
  },

  findAll() {
    return Store.find().sort({ createdAt: -1 });
  },

  findById(id: string) {
    return Store.findById(id);
  },

  findByName(name: string) {
    return Store.findOne({ name });
  },
};