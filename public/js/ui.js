// Utilidades de interfaz compartidas por las vistas.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const STATUS_LABELS = {
  waiting: "En espera",
  serving: "En atención",
  completed: "Completado",
  cancelled: "Cancelado",
  no_show: "No se presentó",
};

export const pill = (status, label) =>
  `<span class="pill ${esc(status)}">${esc(label || STATUS_LABELS[status] || status)}</span>`;

export function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show " + kind;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ""), 3200);
}

export function minutes(value) {
  if (value === null || value === undefined) return "—";
  if (value < 1) return "< 1 min";
  return `${Math.round(value * 10) / 10} min`;
}

export function since(date) {
  if (!date) return "";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (secs < 60) return `${secs} s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const clock = (date) =>
  date ? new Date(date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "—";

// Ejecuta fn cada `ms` mientras la vista esté activa. Devuelve la función para detenerlo.
export function poll(fn, ms) {
  let stopped = false;
  let timer = null;
  const tick = async () => {
    if (stopped) return;
    try {
      await fn();
    } finally {
      if (!stopped) timer = setTimeout(tick, ms);
    }
  };
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

// Añade la clase "flash" al elemento si su texto cambió respecto del render anterior.
export function setText(el, value) {
  if (!el) return;
  const next = String(value);
  if (el.textContent !== next) {
    const hadValue = el.textContent !== "" && el.textContent !== "…";
    el.textContent = next;
    if (hadValue) {
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
  }
}

// ---------- Formularios ----------
export function formData(form) {
  const body = {};
  new FormData(form).forEach((v, k) => (body[k] = String(v).trim()));
  return body;
}

export function clearErrors(form) {
  $$(".field-error, .form-error", form).forEach((el) => el.remove());
  $$("input.invalid", form).forEach((el) => el.classList.remove("invalid"));
}

// Muestra errores de la API: los de validación junto a su campo, el resto arriba del botón.
export function showErrors(form, error) {
  clearErrors(form);
  let placed = 0;
  for (const d of error.details || []) {
    const input = d.field && form.elements[d.field];
    if (input) {
      input.classList.add("invalid");
      input.insertAdjacentHTML("afterend", `<div class="field-error">${esc(d.message)}</div>`);
      placed += 1;
    }
  }
  if (!placed || placed < (error.details || []).length) {
    const btn = $("button[type=submit]", form);
    btn.insertAdjacentHTML("beforebegin", `<div class="form-error">${esc(error.message)}</div>`);
  }
  $("input.invalid", form)?.focus();
}

export async function submitting(form, fn) {
  const btn = $("button[type=submit]", form);
  btn.disabled = true;
  clearErrors(form);
  try {
    await fn();
  } catch (err) {
    showErrors(form, err);
  } finally {
    btn.disabled = false;
  }
}

// Botón destructivo en dos pasos (evita diálogos confirm() que bloquean la página).
export function confirmClick(btn, label = "¿Confirmar?") {
  if (btn.dataset.armed === "1") return true;
  btn.dataset.armed = "1";
  const original = btn.textContent;
  btn.textContent = label;
  btn.classList.add("confirm");
  setTimeout(() => {
    btn.dataset.armed = "";
    btn.textContent = original;
    btn.classList.remove("confirm");
  }, 3000);
  return false;
}

// ---------- Aviso sonoro ----------
let audioCtx = null;
// Los navegadores solo permiten audio tras una interacción; se prepara en el primer toque.
document.addEventListener(
  "pointerdown",
  () => {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      /* sin audio */
    }
  },
  { once: true }
);

export function chime() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.25 + 0.5);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + i * 0.25);
      osc.stop(now + i * 0.25 + 0.55);
    });
  } catch {
    /* sin audio */
  }
}
