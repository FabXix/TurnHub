import { Store } from "../models/store.model";
import { CreateStoreInput } from "../types/type";

export const storeRepository = {
  create(data: CreateStoreInput) {
    return Store.create(data);
  },

  findByName(name: string) {
    return Store.findOne({ name });
  },
};