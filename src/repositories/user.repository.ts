import { User, UserRole } from "../models/user.model";

interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  storeId?: string | null;
}

export const userRepository = {
  create(data: CreateUserData) {
    return User.create(data);
  },

  findByEmail(email: string) {
    return User.findOne({ email: email.toLowerCase() });
  },

  // Incluye el hash (por defecto está oculto con select: false) solo para el login.
  findByEmailWithPassword(email: string) {
    return User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  },

  findById(id: string) {
    return User.findById(id);
  },
};
