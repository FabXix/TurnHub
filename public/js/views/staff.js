// Vistas del personal: acceso, panel del dueño (admin) y panel de atención de una tienda.
import { api } from "../api.js";
import { canManage, session } from "../state.js";
import { $, confirmClick, esc, formData, minutes, poll, setText, since, submitting, toast } from "../ui.js";

// A dónde va cada rol después de iniciar sesión.
export function staffHome(user) {
  if (!user) return "/acceso";
  return user.role === "admin" ? "/panel" : `/gestionar/${user.storeId}`;
}

// ---------------------------------------------------------------------------
// Acceso: iniciar sesión / crear cuenta de dueño
// ---------------------------------------------------------------------------
export function accessView(root, ctx) {
  if (session.user()) return ctx.navigate(staffHome(session.user()));

  root.innerHTML = `
    <div class="page-head"><div><h1>Acceso para negocios</h1><p>Los clientes no necesitan cuenta: solo el personal del negocio inicia sesión.</p></div></div>
    <div class="split">
      <section class="card">
        <div class="tabs" role="tablist">
          <button type="button" class="active" data-tab="login" role="tab">Iniciar sesión</button>
          <button type="button" data-tab="register" role="tab">Crear cuenta de dueño</button>
        </div>
        <form id="login" novalidate>
          <label>Correo<input name="email" type="email" autocomplete="email" required></label>
          <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
          <button class="btn primary block" type="submit">Entrar</button>
        </form>
        <form id="register" hidden novalidate>
          <label>Nombre<input name="name" autocomplete="name" required minlength="2" maxlength="100"></label>
          <label>Correo<input name="email" type="email" autocomplete="email" required></label>
          <label>Contraseña (8 a 72 caracteres)<input name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="72"></label>
          <button class="btn primary block" type="submit">Crear cuenta</button>
        </form>
      </section>
      <section class="card stack">
        <h2>¿Qué cuenta necesito?</h2>
        <div><h3>Dueño del negocio</h3><p class="muted small">Crea tu cuenta aquí. Podrás registrar tus negocios, crear cuentas para tus recepcionistas y atender la fila.</p></div>
        <div><h3>Recepcionista</h3><p class="muted small">El dueño crea tu cuenta desde el panel de su negocio. Inicia sesión con el correo y la contraseña que te dio; solo podrás atender la fila de ese negocio.</p></div>
      </section>
    </div>`;

  root.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]")?.dataset.tab;
    if (!tab) return;
    root.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    $("#login", root).hidden = tab !== "login";
    $("#register", root).hidden = tab !== "register";
    $(`#${tab} input`, root).focus();
  });

  const onAuth = (form, call, msg) =>
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitting(form, async () => {
        const { user, token } = await call(formData(form));
        session.set({ user, token });
        toast(msg(user), "ok");
        ctx.navigate(staffHome(user));
      });
    });

  onAuth($("#login", root), api.login, (u) => `Hola, ${u.name}`);
  onAuth($("#register", root), api.register, (u) => `Cuenta creada. Bienvenido, ${u.name}`);
  $("#login input", root).focus();
}

// ---------------------------------------------------------------------------
// Panel del dueño: sus negocios y registro de uno nuevo (Feature 2)
// ---------------------------------------------------------------------------
export function dashboardView(root, ctx) {
  const user = session.user();
  if (!user) return ctx.navigate("/acceso");
  if (user.role !== "admin") return ctx.navigate(staffHome(user));

  root.innerHTML = `
    <div class="page-head"><div><h1>Hola, ${esc(user.name)}</h1><p>Administra tus negocios y sus filas.</p></div></div>
    <div class="split">
      <section>
        <h2 class="muted small" style="text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px">Mis negocios</h2>
        <div id="mine" class="grid"><div class="card empty">Cargando…</div></div>
      </section>
      <section class="card">
        <h2>Registrar un negocio</h2>
        <form id="create" novalidate>
          <label>Nombre<input name="name" required minlength="2" maxlength="100" placeholder="Barbería El Corte"></label>
          <label>Descripción<input name="description" required maxlength="500" placeholder="Cortes y barba"></label>
          <label>Dirección<input name="address" required maxlength="200" placeholder="Av. Vallarta 123, Guadalajara"></label>
          <label>Teléfono (10 dígitos)<input name="phone" required inputmode="numeric" maxlength="10" placeholder="3312345678"></label>
          <label>Correo de contacto<input name="email" type="email" required placeholder="contacto@negocio.com"></label>
          <button class="btn primary block" type="submit">Registrar negocio</button>
        </form>
      </section>
    </div>`;

  const box = $("#mine", root);
  let mine = [];
  const queues = {};

  const render = () => {
    if (!mine.length) {
      box.innerHTML = `<div class="card empty">Todavía no tienes negocios.<br>Registra el primero con el formulario.</div>`;
      return;
    }
    box.innerHTML = mine
      .map((s) => {
        const st = queues[s._id];
        return `
        <div class="card store-card">
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.address)}</p>
          <div class="meta">
            <span class="chip brand">${st ? `${st.waitingCount} en espera` : "…"}</span>
            <span class="chip">${st && st.currentTicketNumber !== null ? `Atendiendo #${st.currentTicketNumber}` : "Nadie en atención"}</span>
          </div>
          <div class="row" style="margin-top:12px">
            <a class="btn primary sm" href="#/gestionar/${esc(s._id)}">Gestionar fila</a>
            <a class="btn sm" href="#/tienda/${esc(s._id)}">Vista del cliente</a>
          </div>
        </div>`;
      })
      .join("");
  };

  api
    .listStores()
    .then((all) => {
      if (!ctx.alive()) return;
      mine = all.filter((s) => String(s.ownerId) === user.id);
      render();
      ctx.onCleanup(
        poll(async () => {
          await Promise.all(mine.map((s) => api.queueStatus(s._id).then((st) => (queues[s._id] = st)).catch(() => {})));
          if (ctx.alive()) render();
        }, 5000)
      );
    })
    .catch((e) => ctx.alive() && (box.innerHTML = `<div class="card empty">${esc(e.message)}</div>`));

  const form = $("#create", root);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitting(form, async () => {
      const store = await api.createStore(formData(form));
      toast(`“${store.name}” registrado`, "ok");
      ctx.navigate(`/gestionar/${store._id}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Panel de atención de una tienda (Feature 4 + estadísticas de la Feature 6)
// ---------------------------------------------------------------------------
export async function manageView(root, ctx, storeId) {
  const user = session.user();
  if (!user) return ctx.navigate("/acceso");

  root.innerHTML = `<div class="card empty">Cargando…</div>`;
  let store;
  try {
    store = await api.getStore(storeId);
  } catch (e) {
    if (ctx.alive()) root.innerHTML = `<div class="card empty">${esc(e.message)}</div>`;
    return;
  }
  if (!ctx.alive()) return;

  if (!canManage(store)) {
    root.innerHTML = `
      <div class="card empty">
        <p><b>No tienes permiso para gestionar “${esc(store.name)}”.</b></p>
        <p>${user.role === "admin" ? "Solo el dueño del negocio puede atender su fila." : "Tu cuenta de recepcionista pertenece a otro negocio."}</p>
        <a class="btn" href="#${staffHome(user)}">Ir a mi panel</a>
      </div>`;
    return;
  }

  const isAdmin = user.role === "admin";
  root.innerHTML = `
    ${isAdmin ? '<a class="crumb" href="#/panel">← Mis negocios</a>' : ""}
    <div class="page-head">
      <div><h1>${esc(store.name)}</h1><p>Panel de atención · ${isAdmin ? "Dueño" : "Recepcionista"}</p></div>
      <div class="row">
        <a class="btn" href="#/pantalla/${esc(storeId)}" target="_blank" rel="noopener">Abrir pantalla de turnos</a>
        <a class="btn" href="#/tienda/${esc(storeId)}">Vista del cliente</a>
      </div>
    </div>

    <div class="split">
      <div class="stack">
        <section class="card">
          <h2>En atención</h2>
          <div id="serving" class="serving-box"><div class="none">…</div></div>
          <button class="btn primary big" data-action="next" id="next" style="margin-top:16px">Llamar siguiente turno</button>
          <p class="small muted" style="margin:8px 0 0">Al llamar al siguiente, el turno en atención se marca como completado.</p>
        </section>
        <section class="card">
          <h2>En espera · <span id="wcount">…</span></h2>
          <ul class="list" id="waiting"></ul>
        </section>
      </div>

      <div class="stack">
        <section class="card">
          <h2>Estadísticas</h2>
          <div class="stats">
            <div class="stat hl"><div class="n" id="s-eta">…</div><div class="l">Espera estimada</div></div>
            <div class="stat"><div class="n" id="s-avg">…</div><div class="l">Promedio de atención</div></div>
            <div class="stat"><div class="n" id="s-completed">…</div><div class="l">Atendidos</div></div>
            <div class="stat"><div class="n" id="s-cancelled">…</div><div class="l">Cancelados</div></div>
            <div class="stat"><div class="n" id="s-noshow">…</div><div class="l">No se presentaron</div></div>
          </div>
        </section>
        ${
          isAdmin
            ? `<section class="card">
                <h2>Recepcionistas</h2>
                <p class="small muted" style="margin:0">Crea una cuenta para quien atiende el mostrador. Solo podrá gestionar la fila de este negocio.</p>
                <form id="operator" novalidate>
                  <label>Nombre<input name="name" required minlength="2" maxlength="100"></label>
                  <label>Correo<input name="email" type="email" required autocomplete="off"></label>
                  <label>Contraseña (8 a 72 caracteres)<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></label>
                  <button class="btn primary block" type="submit">Crear recepcionista</button>
                </form>
                <ul class="list" id="operators" style="margin-top:12px"></ul>
              </section>`
            : ""
        }
      </div>
    </div>`;

  let serving = null;
  let lastKey = "";
  let busy = false;

  const refreshTimes = () =>
    root.querySelectorAll("[data-since]").forEach((el) => (el.textContent = since(el.dataset.since)));

  const renderQueue = (tickets) => {
    serving = tickets.find((t) => t.status === "serving") || null;
    const waiting = tickets.filter((t) => t.status === "waiting");
    $("#next", root).disabled = busy || waiting.length === 0;
    setText($("#wcount", root), waiting.length);

    // Solo se vuelve a pintar si cambió la fila (así no se pierde un "¿Confirmar?" a medio clic).
    const key = tickets.map((t) => `${t._id}:${t.status}`).join("|");
    if (key !== lastKey) {
      lastKey = key;
      $("#serving", root).innerHTML = serving
        ? `<div class="num">#${serving.ticketNumber}</div>
           <div class="small muted">Llamado a las ${new Date(serving.calledAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} · hace <span data-since="${esc(serving.calledAt)}"></span></div>
           <div class="actions">
             <button class="btn ok" data-action="completed" data-id="${esc(serving._id)}">Atendido</button>
             <button class="btn warn" data-action="no_show" data-id="${esc(serving._id)}">No se presentó</button>
           </div>`
        : `<div class="none">Nadie en atención.<br><span class="small">${waiting.length ? "Llama al siguiente turno." : "La fila está vacía."}</span></div>`;

      $("#waiting", root).innerHTML = waiting.length
        ? waiting
            .map(
              (t, i) => `
              <li>
                <span class="num">#${t.ticketNumber}</span>
                <span class="grow"><b>${i === 0 ? "Siguiente" : `Posición ${i + 1}`}</b><br>
                  <span class="small muted">Esperando hace <span data-since="${esc(t.createdAt)}"></span></span></span>
                <button class="btn danger sm" data-action="cancelled" data-id="${esc(t._id)}">Cancelar</button>
              </li>`
            )
            .join("")
        : `<li class="empty" style="display:block">No hay personas en espera.</li>`;
    }
    refreshTimes();
  };

  const refresh = async () => {
    try {
      const [tickets, stats] = await Promise.all([api.listTickets(storeId, ["waiting", "serving"]), api.queueStats(storeId)]);
      if (!ctx.alive()) return;
      renderQueue(tickets);
      setText($("#s-eta", root), minutes(stats.estimatedWaitMinutes));
      setText($("#s-avg", root), minutes(stats.averageServiceMinutes));
      setText($("#s-completed", root), stats.completedCount);
      setText($("#s-cancelled", root), stats.cancelledCount);
      setText($("#s-noshow", root), stats.noShowCount);
    } catch (e) {
      if (!ctx.alive()) return;
      if (e.status === 403) {
        toast("Ya no tienes acceso a esta tienda", "err");
        ctx.navigate(staffHome(session.user()));
      } else if (e.status !== 401) toast(e.message, "err");
    }
  };

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || busy) return;
    const { action, id } = btn.dataset;
    if (action === "cancelled" && !confirmClick(btn)) return;

    busy = true;
    btn.disabled = true;
    try {
      if (action === "next") {
        const r = await api.callNext(storeId);
        toast(
          `Llamando al turno #${r.currentTicket.ticketNumber}` +
            (r.previousTicket ? ` · #${r.previousTicket.ticketNumber} atendido` : ""),
          "ok"
        );
      } else {
        const t = await api.setTicketStatus(storeId, id, action);
        const msg = { completed: "atendido", no_show: "marcado como no presentado", cancelled: "cancelado" }[action];
        toast(`Turno #${t.ticketNumber} ${msg}`, "ok");
      }
    } catch (err) {
      toast(err.message, "err");
    } finally {
      busy = false;
      btn.disabled = false;
      lastKey = "";
      await refresh();
    }
  });

  ctx.onCleanup(poll(refresh, 3000));
  const timer = setInterval(refreshTimes, 1000);
  ctx.onCleanup(() => clearInterval(timer));

  const opForm = $("#operator", root);
  if (opForm) {
    opForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitting(opForm, async () => {
        const op = await api.createOperator(storeId, formData(opForm));
        opForm.reset();
        $("#operators", root).insertAdjacentHTML(
          "afterbegin",
          `<li><span class="grow"><b>${esc(op.name)}</b><br><span class="small muted">${esc(op.email)} · ya puede iniciar sesión</span></span><span class="pill serving">Creado</span></li>`
        );
        toast(`Recepcionista ${op.name} creado`, "ok");
      });
    });
  }
}
