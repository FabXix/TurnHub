// Estado del navegador: sesión del personal y turnos que el cliente ha tomado en este dispositivo.
// Todo acceso a localStorage va en try/catch (modo privado o almacenamiento bloqueado).

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: la app sigue funcionando en memoria */
  }
}

// ---------- Sesión (admin u operador) ----------
const SESSION_KEY = "turnhub.session";
let current = read(SESSION_KEY, null); // { token, user: { id, name, email, role, storeId } }
const listeners = new Set();

export const session = {
  get: () => current,
  user: () => current?.user ?? null,
  set(value) {
    current = value;
    write(SESSION_KEY, value);
    listeners.forEach((fn) => fn(current, null));
  },
  updateUser(user) {
    if (!current) return;
    current = { ...current, user };
    write(SESSION_KEY, current);
    listeners.forEach((fn) => fn(current, null));
  },
  clear(reason = "logout") {
    if (!current) return;
    current = null;
    write(SESSION_KEY, null);
    listeners.forEach((fn) => fn(null, reason));
  },
  onChange: (fn) => listeners.add(fn),
};

// El admin gestiona sus tiendas; el operador solo la tienda asignada.
export function canManage(store) {
  const u = session.user();
  if (!u || !store) return false;
  return u.role === "admin" ? String(store.ownerId) === u.id : u.storeId === String(store._id);
}

// ---------- Mis turnos (cliente, sin cuenta) ----------
const TICKETS_KEY = "turnhub.myTickets";

export const myTickets = {
  all: () => read(TICKETS_KEY, []),
  add(ticket) {
    const list = myTickets.all().filter((t) => t.ticketId !== ticket.ticketId);
    list.unshift(ticket);
    write(TICKETS_KEY, list.slice(0, 30));
  },
  update(ticketId, patch) {
    const list = myTickets.all();
    const item = list.find((t) => t.ticketId === ticketId);
    if (!item) return;
    Object.assign(item, patch);
    write(TICKETS_KEY, list);
  },
  activeCount: () => myTickets.all().filter((t) => !FINAL_STATUSES.includes(t.lastStatus)).length,
  remove(ticketId) {
    write(TICKETS_KEY, myTickets.all().filter((t) => t.ticketId !== ticketId));
  },
  replace(list) {
    write(TICKETS_KEY, list);
  },
};

export const FINAL_STATUSES = ["completed", "cancelled", "no_show"];
