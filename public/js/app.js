// Punto de entrada: navegación por hash, barra superior y arranque de la sesión.
import { api } from "./api.js";
import { FINAL_STATUSES, myTickets, session } from "./state.js";
import { $, esc, toast } from "./ui.js";
import { displayView, homeView, myTicketsView, storeView, ticketView } from "./views/customer.js";
import { accessView, dashboardView, manageView, staffHome } from "./views/staff.js";

const routes = [
  [/^\/$/, homeView],
  [/^\/tienda\/([^/]+)$/, storeView],
  [/^\/turno\/([^/]+)\/([^/]+)$/, ticketView],
  [/^\/mis-turnos$/, myTicketsView],
  [/^\/pantalla\/([^/]+)$/, displayView],
  [/^\/acceso$/, accessView],
  [/^\/panel$/, dashboardView],
  [/^\/gestionar\/([^/]+)$/, manageView],
];

const STAFF_ROUTES = /^\/(panel|gestionar)/;
const currentPath = () => decodeURI(location.hash.replace(/^#/, "")) || "/";
const navigate = (path) => {
  if (currentPath() === path) render();
  else location.hash = "#" + path;
};

// ---------- Barra superior ----------
function renderNav() {
  const path = currentPath();
  const user = session.user();
  const active = (re) => (re.test(path) ? "active" : "");
  const count = myTickets.activeCount();

  $("#nav").innerHTML = `
    <a href="#/" class="${active(/^\/($|tienda)/)}">Negocios</a>
    <a href="#/mis-turnos" class="${active(/^\/(mis-turnos|turno)/)}">Mis turnos${count ? `<span class="badge">${count}</span>` : ""}</a>
    <span class="spacer"></span>
    ${
      user
        ? `<span class="who"><b>${esc(user.name)}</b> · ${user.role === "admin" ? "Dueño" : "Recepcionista"}</span>
           <a href="#${staffHome(user)}" class="${active(STAFF_ROUTES)}">Mi panel</a>
           <button class="navlink" id="logout" type="button">Salir</button>`
        : `<a href="#/acceso" class="${active(/^\/acceso/)}">Acceso negocios</a>`
    }`;
  $("#logout")?.addEventListener("click", () => session.clear("logout"));
}

// ---------- Router ----------
let cleanups = [];
let generation = 0;

function render() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  const gen = ++generation;

  const path = currentPath();
  const match = routes.map(([re, view]) => [path.match(re), view]).find(([m]) => m);

  // Cada vista recibe un contenedor nuevo: sus listeners desaparecen con ella.
  const root = document.createElement("div");
  $("#view").replaceChildren(root);
  renderNav();
  window.scrollTo(0, 0);

  const ctx = {
    alive: () => gen === generation,
    onCleanup: (fn) => (gen === generation ? cleanups.push(fn) : fn()),
    navigate,
    refreshNav: renderNav,
  };

  if (!match) {
    root.innerHTML = `<div class="card empty"><p><b>Página no encontrada</b></p><a class="btn" href="#/">Ir a negocios</a></div>`;
    return;
  }
  const [m, view] = match;
  view(root, ctx, ...m.slice(1));
}

window.addEventListener("hashchange", render);

session.onChange((s, reason) => {
  renderNav();
  if (s) return;
  if (reason === "expired") toast("Tu sesión expiró, inicia sesión de nuevo", "err");
  else toast("Sesión cerrada");
  if (STAFF_ROUTES.test(currentPath())) navigate(reason === "expired" ? "/acceso" : "/");
  else render();
});

// ---------- Arranque ----------
async function checkHealth() {
  try {
    await api.health();
    $("#health").classList.add("on");
  } catch {
    $("#health").classList.remove("on");
  }
}

// Mantiene al día el contador de "Mis turnos" aunque el cliente esté en otra vista.
async function refreshMyTickets() {
  const active = myTickets.all().filter((t) => !FINAL_STATUSES.includes(t.lastStatus));
  await Promise.all(
    active.map((t) =>
      api
        .getTicket(t.storeId, t.ticketId)
        .then((d) => myTickets.update(t.ticketId, { lastStatus: d.status }))
        .catch(() => {})
    )
  );
  if (active.length) renderNav();
}

render();
checkHealth();
refreshMyTickets();
setInterval(checkHealth, 10000);
setInterval(refreshMyTickets, 15000);

// Valida el token guardado y refresca los datos del usuario.
if (session.get()) {
  api.me().then((user) => session.updateUser(user)).catch(() => {});
}
