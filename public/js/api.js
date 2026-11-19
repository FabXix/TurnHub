// Cliente HTTP de la API de TurnHub. Una función por endpoint.
import { session } from "./state.js";

// Mismo origen cuando la sirve Express; respaldo si se abre como archivo.
const BASE = location.protocol.startsWith("http") ? "" : "http://localhost:3000";

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = Array.isArray(details) ? details : [];
  }
}

async function request(method, path, body) {
  const token = session.get()?.token;
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Token vencido o cuenta borrada: se cierra la sesión local.
    if (res.status === 401 && token) session.clear("expired");
    throw new ApiError(data.error || `Error ${res.status}`, res.status, data.details);
  }
  return data;
}

const enc = encodeURIComponent;

export const api = {
  health: () => request("GET", "/health"),

  // Autenticación
  register: (body) => request("POST", "/api/auth/register", body),
  login: (body) => request("POST", "/api/auth/login", body),
  me: () => request("GET", "/api/auth/me"),

  // Feature 1 y 2: tiendas
  listStores: () => request("GET", "/api/stores"),
  getStore: (id) => request("GET", `/api/stores/${enc(id)}`),
  createStore: (body) => request("POST", "/api/stores", body),
  createOperator: (storeId, body) => request("POST", `/api/stores/${enc(storeId)}/operators`, body),

  // Feature 3: cola
  joinQueue: (storeId) => request("POST", `/api/stores/${enc(storeId)}/queue`),
  queueStatus: (storeId) => request("GET", `/api/stores/${enc(storeId)}/queue`),

  // Feature 4: atención (personal)
  callNext: (storeId) => request("PATCH", `/api/stores/${enc(storeId)}/queue/next`),
  listTickets: (storeId, statuses) =>
    request("GET", `/api/stores/${enc(storeId)}/tickets${statuses ? "?status=" + enc(statuses.join(",")) : ""}`),
  setTicketStatus: (storeId, ticketId, status) =>
    request("PATCH", `/api/stores/${enc(storeId)}/tickets/${enc(ticketId)}`, { status }),

  // Feature 5: mi turno
  getTicket: (storeId, ticketId) => request("GET", `/api/stores/${enc(storeId)}/tickets/${enc(ticketId)}`),

  // Feature 6: estadísticas
  queueStats: (storeId) => request("GET", `/api/stores/${enc(storeId)}/queue/stats`),
};
