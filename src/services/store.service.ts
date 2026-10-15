import { isValidObjectId } from "mongoose";
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

  listStores() {
    return storeRepository.findAll();
  },

  async getStore(id: string) {
    if (!isValidObjectId(id)) {
      throw new AppError(400, "Identificador de empresa inválido");
    }
    const store = await storeRepository.findById(id);
    if (!store) {
      throw new AppError(404, "Empresa no encontrada");
    }
    return store;
  },
};