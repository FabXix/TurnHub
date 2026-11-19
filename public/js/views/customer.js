// Vistas públicas (clientes sin cuenta): negocios, fila, mi turno, mis turnos y pantalla de turnos.
import { api } from "../api.js";
import { canManage, FINAL_STATUSES, myTickets } from "../state.js";
import { $, chime, clock, esc, minutes, pill, poll, setText, STATUS_LABELS, toast } from "../ui.js";

const loadError = (e) => `
  <div class="card empty">
    <p><b>No se pudo cargar la información.</b></p>
    <p>${esc(e.message)}</p>
    ${e.status === 0 ? '<p class="small">¿Está corriendo el servidor (<code>npm run dev</code>) y MongoDB (<code>docker compose up -d</code>)?</p>' : ""}
    <a class="btn" href="#/">Volver a negocios</a>
  </div>`;

// ---------------------------------------------------------------------------
// Feature 1: lista de negocios
// ---------------------------------------------------------------------------
export function homeView(root, ctx) {
  root.innerHTML = `
    <section class="hero">
      <div class="hero-inner">
        <h1>Toma tu turno sin hacer fila</h1>
        <p>Busca el negocio, reserva tu lugar en la fila y recibe el aviso cuando sea tu turno.</p>
        <div class="searchbar">
          <input id="search" type="search" placeholder="Buscar por negocio, dirección o servicio" aria-label="Buscar negocio">
        </div>
      </div>
    </section>
    <ol class="how">
      <li><b>1</b><span><strong>Elige el negocio</strong>Consulta cuántas personas esperan.</span></li>
      <li><b>2</b><span><strong>Toma tu turno</strong>Sin registro ni filas físicas.</span></li>
      <li><b>3</b><span><strong>Recibe el aviso</strong>Te notificamos cuando te llamen.</span></li>
    </ol>
    <div class="section-head">
      <h2>Negocios disponibles</h2>
      <span class="muted small" id="count"></span>
    </div>
    <div id="stores" class="listing"><div class="card empty">Cargando…</div></div>`;

  let stores = null;
  const queues = {};
  const box = $("#stores", root);

  const render = () => {
    if (!stores) return;
    const q = $("#search", root).value.trim().toLowerCase();
    const list = stores.filter((s) => `${s.name} ${s.address} ${s.description}`.toLowerCase().includes(q));
    if (!stores.length) {
      box.innerHTML = `<div class="card empty">Aún no hay negocios registrados.<br><a href="#/acceso">¿Tienes un negocio? Regístralo aquí</a></div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = `<div class="card empty">Ningún negocio coincide con “${esc(q)}”.</div>`;
      return;
    }
    $("#count", root).textContent = `${list.length} ${list.length === 1 ? "resultado" : "resultados"}`;
    box.innerHTML = list
      .map((s) => {
        const st = queues[s._id];
        const mine = canManage(s) ? '<span class="chip brand">Tu negocio</span>' : "";
        return `
        <a class="listing-row" href="#/tienda/${esc(s._id)}">
          <div class="datebox"><span class="n">${st ? st.waitingCount : "–"}</span><span class="l">en espera</span></div>
          <div class="info">
            <h3>${esc(s.name)}</h3>
            <p>${[s.address, s.description].filter(Boolean).map(esc).join(" · ") || "Sin detalles"}</p>
            <div class="meta">
              ${st && st.currentTicketNumber !== null ? `<span class="chip">Atendiendo: turno ${st.currentTicketNumber}</span>` : '<span class="chip">Sin turno en atención</span>'}
              ${mine}
            </div>
          </div>
          <span class="btn primary">Ver fila</span>
        </a>`;
      })
      .join("");
  };

  $("#search", root).addEventListener("input", render);

  api
    .listStores()
    .then((list) => {
      if (!ctx.alive()) return;
      stores = list;
      render();
      ctx.onCleanup(
        poll(async () => {
          await Promise.all(
            stores.map((s) =>
              api.queueStatus(s._id).then((st) => (queues[s._id] = st)).catch(() => {})
            )
          );
          if (ctx.alive()) render();
        }, 10000)
      );
    })
    .catch((e) => ctx.alive() && (box.innerHTML = loadError(e)));
}

// ---------------------------------------------------------------------------
// Feature 3 y 6: detalle de un negocio, estado de la fila y tomar turno
// ---------------------------------------------------------------------------
export async function storeView(root, ctx, storeId) {
  root.innerHTML = `<div class="card empty">Cargando…</div>`;
  let store;
  try {
    store = await api.getStore(storeId);
  } catch (e) {
    if (ctx.alive()) root.innerHTML = loadError(e);
    return;
  }
  if (!ctx.alive()) return;

  const active = myTickets.all().filter((t) => t.storeId === storeId && !FINAL_STATUSES.includes(t.lastStatus));

  root.innerHTML = `
    <a class="crumb" href="#/">← Negocios</a>
    <div class="page-head">
      <div>
        <h1>${esc(store.name)}</h1>
        <p>${esc(store.description)}</p>
        <div class="row" style="margin-top:10px">
          <span class="chip">${esc(store.address)}</span>
          <span class="chip">Tel. ${esc(store.phone)}</span>
          <span class="chip">${esc(store.email)}</span>
        </div>
      </div>
      <div class="row">
        ${canManage(store) ? `<a class="btn primary" href="#/gestionar/${esc(storeId)}">Gestionar fila</a>` : ""}
        <a class="btn" href="#/pantalla/${esc(storeId)}" target="_blank" rel="noopener">Pantalla de turnos</a>
      </div>
    </div>

    <div class="split">
      <section class="card">
        <h2>La fila ahora</h2>
        <div class="stats">
          <div class="stat hl"><div class="n" id="serving">…</div><div class="l">Atendiendo</div></div>
          <div class="stat"><div class="n" id="waiting">…</div><div class="l">Personas en espera</div></div>
          <div class="stat"><div class="n" id="eta">…</div><div class="l">Espera estimada</div></div>
          <div class="stat"><div class="n" id="last">…</div><div class="l">Último turno entregado</div></div>
        </div>
        ${
          active.length
            ? `<div class="notice" style="margin-top:16px">Ya tienes ${active.length === 1 ? "un turno" : "turnos"} en este negocio:
                ${active.map((t) => `<a href="#/turno/${esc(storeId)}/${esc(t.ticketId)}"><b>#${t.ticketNumber}</b></a>`).join(", ")}</div>`
            : ""
        }
        <button class="btn primary big" id="join" style="margin-top:16px">Tomar turno</button>
        <p class="small muted" style="margin:10px 0 0">No necesitas cuenta. Tu turno queda guardado en este dispositivo y te avisamos cuando te llamen.</p>
      </section>

      <section class="card">
        <h2>Estadísticas</h2>
        <div class="stats">
          <div class="stat"><div class="n" id="avg">…</div><div class="l">Promedio de atención</div></div>
          <div class="stat"><div class="n" id="completed">…</div><div class="l">Atendidos</div></div>
          <div class="stat"><div class="n" id="cancelled">…</div><div class="l">Cancelados</div></div>
          <div class="stat"><div class="n" id="noshow">…</div><div class="l">No se presentaron</div></div>
        </div>
        <p class="small muted" id="stats-note" style="margin:12px 0 0"></p>
      </section>
    </div>`;

  ctx.onCleanup(
    poll(async () => {
      try {
        const [st, stats] = await Promise.all([api.queueStatus(storeId), api.queueStats(storeId)]);
        if (!ctx.alive()) return;
        setText($("#serving", root), st.currentTicketNumber === null ? "—" : `#${st.currentTicketNumber}`);
        setText($("#waiting", root), st.waitingCount);
        setText($("#last", root), st.lastTicketNumber ? `#${st.lastTicketNumber}` : "—");
        setText($("#eta", root), minutes(stats.estimatedWaitMinutes));
        setText($("#avg", root), minutes(stats.averageServiceMinutes));
        setText($("#completed", root), stats.completedCount);
        setText($("#cancelled", root), stats.cancelledCount);
        setText($("#noshow", root), stats.noShowCount);
        $("#stats-note", root).textContent =
          stats.averageServiceMinutes === null
            ? "Aún no hay turnos completados para estimar tiempos."
            : "El promedio usa los últimos 20 turnos atendidos.";
      } catch (e) {
        if (ctx.alive()) toast(e.message, "err");
      }
    }, 3000)
  );

  $("#join", root).addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      const ticket = await api.joinQueue(storeId);
      myTickets.add({
        storeId,
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        storeName: store.name,
        createdAt: ticket.createdAt,
        lastStatus: ticket.status,
      });
      toast(`Tu turno es el #${ticket.ticketNumber}`, "ok");
      ctx.navigate(`/turno/${storeId}/${ticket._id}`);
    } catch (e) {
      toast(e.message, "err");
      btn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Feature 5: mi turno y mi posición
// ---------------------------------------------------------------------------
const STATUS_MESSAGES = {
  waiting: "Te avisaremos aquí cuando sea tu turno. Mantén esta página abierta.",
  serving: "¡Es tu turno! Acércate al mostrador.",
  completed: "Gracias por tu visita. Tu turno fue atendido.",
  cancelled: "Este turno fue cancelado.",
  no_show: "Te llamamos pero no te presentaste. Puedes tomar un turno nuevo.",
};

export async function ticketView(root, ctx, storeId, ticketId) {
  root.innerHTML = `<div class="card empty">Cargando tu turno…</div>`;
  const saved = myTickets.all().find((t) => t.ticketId === ticketId);
  let storeName = saved?.storeName;
  if (!storeName) {
    try {
      storeName = (await api.getStore(storeId)).name;
    } catch (e) {
      if (ctx.alive()) root.innerHTML = loadError(e);
      return;
    }
  }
  if (!ctx.alive()) return;

  root.innerHTML = `
    <div class="ticket-wrap">
      <a class="crumb" href="#/mis-turnos">← Mis turnos</a>
      <div id="ticket"></div>
      <div id="message"></div>
      <div class="callout">
        <div class="row" style="justify-content:space-between">
          <span class="small muted">Atendiendo ahora en ${esc(storeName)}</span>
          <b id="now-serving">…</b>
        </div>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn" id="copy">Copiar enlace</button>
        <a class="btn" href="#/tienda/${esc(storeId)}">Ver fila del negocio</a>
      </div>
      <p class="small muted">Si ya no vas a asistir, avisa al personal para que cancele tu turno.</p>
    </div>`;

  $("#copy", root).addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Enlace copiado", "ok");
    } catch {
      toast("Copia la dirección de la barra del navegador");
    }
  });

  let prevStatus = null;
  let initialAhead = null;
  const baseTitle = document.title;
  ctx.onCleanup(() => (document.title = baseTitle));

  const stop = poll(async () => {
    let t, stats;
    try {
      [t, stats] = await Promise.all([api.getTicket(storeId, ticketId), api.queueStats(storeId)]);
    } catch (e) {
      if (!ctx.alive()) return;
      if (e.status === 404 || e.status === 400) {
        root.innerHTML = loadError(e);
        stop();
      } else toast(e.message, "err");
      return;
    }
    if (!ctx.alive()) return;

    if (!saved && prevStatus === null) {
      // Turno abierto desde un enlace compartido: se guarda en "Mis turnos".
      myTickets.add({ storeId, ticketId, ticketNumber: t.ticketNumber, storeName, createdAt: t.createdAt, lastStatus: t.status });
    }
    myTickets.update(ticketId, { lastStatus: t.status });
    ctx.refreshNav();

    if (initialAhead === null && t.aheadOfYou !== null) initialAhead = t.aheadOfYou;
    const final = FINAL_STATUSES.includes(t.status);
    const eta =
      t.aheadOfYou !== null && stats.averageServiceMinutes !== null
        ? minutes(Math.ceil(t.aheadOfYou * stats.averageServiceMinutes))
        : "—";
    const progress = initialAhead ? Math.round(((initialAhead - t.aheadOfYou) / initialAhead) * 100) : 100;

    $("#ticket", root).innerHTML = `
      <div class="ticket ${t.status === "serving" ? "serving" : final ? "final" : ""}">
        <div class="ticket-head">
          <span class="store">${esc(storeName)}</span>
          <span class="status">${esc(t.statusLabel || STATUS_LABELS[t.status])}</span>
        </div>
        <div class="ticket-body">
          <div class="label">Número de turno</div>
          <div class="num">${t.ticketNumber}</div>
        </div>
        <div class="perforation"></div>
        ${
          t.status === "waiting"
            ? `<div class="facts">
                <div><div class="n">${t.position}</div><div class="l">Posición</div></div>
                <div><div class="n">${t.aheadOfYou}</div><div class="l">Delante de ti</div></div>
                <div><div class="n">${eta}</div><div class="l">Espera aprox.</div></div>
              </div>`
            : `<div class="facts">
                <div><div class="n">${clock(t.createdAt)}</div><div class="l">Tomado</div></div>
                <div><div class="n">${clock(t.calledAt)}</div><div class="l">Llamado</div></div>
                <div><div class="n">${clock(t.finishedAt)}</div><div class="l">Finalizado</div></div>
              </div>`
        }
        <div class="ticket-foot">
          <div class="barcode" aria-hidden="true"></div>
          <div class="code">${esc(String(ticketId).slice(-10).toUpperCase())}</div>
        </div>
      </div>`;

    $("#message", root).innerHTML = `
      <div class="callout ${t.status === "serving" ? "ok" : ""}">
        ${t.status === "waiting" ? `<div class="small muted">Avance de la fila</div><div class="progress"><span style="width:${progress}%"></span></div>` : ""}
        <div ${t.status === "waiting" ? 'class="small" style="margin-top:8px"' : ""}>${STATUS_MESSAGES[t.status]}</div>
        ${final ? `<a class="btn primary block" href="#/tienda/${esc(storeId)}">Tomar otro turno</a>` : ""}
      </div>`;

    setText($("#now-serving", root), stats.currentlyServing === null ? "Nadie" : `#${stats.currentlyServing}`);

    if (t.status === "serving" && prevStatus && prevStatus !== "serving") {
      chime();
      navigator.vibrate?.([300, 150, 300]);
      toast("¡Es tu turno!", "ok");
    }
    document.title = t.status === "serving" ? `🔔 ¡Es tu turno! #${t.ticketNumber}` : `Turno #${t.ticketNumber} · TurnHub`;
    prevStatus = t.status;
    if (final) stop();
  }, 3000);
  ctx.onCleanup(stop);
}

// ---------------------------------------------------------------------------
// Feature 5: mis turnos (guardados en este dispositivo)
// ---------------------------------------------------------------------------
export function myTicketsView(root, ctx) {
  root.innerHTML = `
    <div class="page-head">
      <div><h1>Mis turnos</h1><p>Los turnos que tomaste desde este dispositivo.</p></div>
      <button class="btn" id="clear">Quitar finalizados</button>
    </div>
    <section class="card"><ul class="list" id="list"></ul></section>`;

  const details = {};

  const render = () => {
    const list = myTickets.all();
    const ul = $("#list", root);
    if (!list.length) {
      ul.innerHTML = `<li class="empty" style="display:block">Aún no has tomado turnos. <a href="#/">Busca un negocio</a></li>`;
      return;
    }
    ul.innerHTML = list
      .map((t) => {
        const d = details[t.ticketId];
        const status = d?.status ?? t.lastStatus;
        const where =
          d === null
            ? "Ya no existe"
            : status === "waiting" && d
              ? `Posición ${d.position} · ${d.aheadOfYou} delante de ti`
              : `Tomado a las ${clock(t.createdAt)}`;
        return `
        <li>
          <span class="num">#${t.ticketNumber}</span>
          <a class="grow" href="#/turno/${esc(t.storeId)}/${esc(t.ticketId)}">
            <b>${esc(t.storeName)}</b><br><span class="small muted">${esc(where)}</span>
          </a>
          ${status ? pill(status) : ""}
          <button class="btn sm" data-remove="${esc(t.ticketId)}" aria-label="Quitar">✕</button>
        </li>`;
      })
      .join("");
  };

  root.addEventListener("click", (e) => {
    const id = e.target.closest("[data-remove]")?.dataset.remove;
    if (!id) return;
    myTickets.remove(id);
    ctx.refreshNav();
    render();
  });
  $("#clear", root).addEventListener("click", () => {
    myTickets.replace(myTickets.all().filter((t) => !FINAL_STATUSES.includes(details[t.ticketId]?.status ?? t.lastStatus) && details[t.ticketId] !== null));
    ctx.refreshNav();
    render();
  });

  render();
  ctx.onCleanup(
    poll(async () => {
      await Promise.all(
        myTickets.all().map((t) =>
          api
            .getTicket(t.storeId, t.ticketId)
            .then((d) => {
              details[t.ticketId] = d;
              myTickets.update(t.ticketId, { lastStatus: d.status });
            })
            .catch((e) => {
              if (e.status === 404 || e.status === 400) details[t.ticketId] = null;
            })
        )
      );
      if (!ctx.alive()) return;
      ctx.refreshNav();
      render();
    }, 5000)
  );
}

// ---------------------------------------------------------------------------
// Pantalla de turnos (para una TV en el negocio)
// ---------------------------------------------------------------------------
export async function displayView(root, ctx, storeId) {
  document.body.classList.add("kiosk");
  ctx.onCleanup(() => document.body.classList.remove("kiosk"));
  root.innerHTML = `<div class="display"><div class="center">Cargando…</div></div>`;

  let store;
  try {
    store = await api.getStore(storeId);
  } catch (e) {
    if (ctx.alive()) root.innerHTML = `<div class="display"><div class="center">${esc(e.message)}</div></div>`;
    return;
  }
  if (!ctx.alive()) return;

  root.innerHTML = `
    <div class="display">
      <a class="exit" href="#/tienda/${esc(storeId)}">Salir</a>
      <div class="top"><h1>${esc(store.name)}</h1><div class="clock" id="clock"></div></div>
      <div class="center">
        <div>
          <div class="label">Turno en atención</div>
          <div class="num" id="num">—</div>
        </div>
      </div>
      <div class="bottom">
        <div><div class="n" id="waiting">…</div><div class="l">En espera</div></div>
        <div><div class="n" id="last">…</div><div class="l">Último turno entregado</div></div>
        <div><div class="n" id="eta">…</div><div class="l">Espera estimada</div></div>
      </div>
    </div>`;

  const tickClock = () => ($("#clock", root).textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
  tickClock();
  const clockTimer = setInterval(tickClock, 1000);
  ctx.onCleanup(() => clearInterval(clockTimer));

  let prev;
  ctx.onCleanup(
    poll(async () => {
      try {
        const [st, stats] = await Promise.all([api.queueStatus(storeId), api.queueStats(storeId)]);
        if (!ctx.alive()) return;
        const num = st.currentTicketNumber === null ? "—" : `#${st.currentTicketNumber}`;
        const el = $("#num", root);
        if (prev !== undefined && prev !== num && st.currentTicketNumber !== null) {
          el.classList.remove("flash");
          void el.offsetWidth;
          el.classList.add("flash");
          chime();
        }
        el.textContent = num;
        prev = num;
        $("#waiting", root).textContent = st.waitingCount;
        $("#last", root).textContent = st.lastTicketNumber ? `#${st.lastTicketNumber}` : "—";
        $("#eta", root).textContent = minutes(stats.estimatedWaitMinutes);
      } catch {
        /* la pantalla sigue mostrando el último dato */
      }
    }, 3000)
  );
}
