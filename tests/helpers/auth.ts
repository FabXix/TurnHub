import { authService } from "../../src/services/auth.service";

export const OWNER_ID = "665f1c2e8b3a4d00aaaaaaaa";
export const OTHER_ADMIN_ID = "665f1c2e8b3a4d00bbbbbbbb";
export const OPERATOR_ID = "665f1c2e8b3a4d00cccccccc";

// Genera un header Authorization con un JWT firmado igual que en el login real.
export function bearer(
  role: "admin" | "operator",
  userId: string,
  storeId: string | null = null
): string {
  const token = authService.signToken({ _id: userId, name: "Test", email: "t@t.com", role, storeId });
  return `Bearer ${token}`;
}
