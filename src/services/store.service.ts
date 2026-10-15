import { storeRepository } from "../repositories/store.repository";
import { AppError, CreateStoreInput } from "../types/type";

export const storeService = {
  async registerStore(data: CreateStoreInput) {
    const existing = await storeRepository.findByName(data.name);
    if (existing) {
      throw new AppError(409, "Ya existe una empresa registrada con ese nombre");
    }
    return storeRepository.create(data);
  },
};