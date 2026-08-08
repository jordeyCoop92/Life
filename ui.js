const STATUS_LABELS = {
  to_do: "To do",
  in_progress: "In progress",
  hold: "Hold",
  review: "To review",
  completed: "Completed",
  overdue: "Overdue",
  canceled: "Canceled"
};

const PRIORITY_LABELS = {
  very_high: "Very high",
  high: "High",
  medium: "Medium",
  low: "Low",
  very_low: "Very low"
};

function statusBadge(status) {
  const s = status || "to_do";
  const label = STATUS_LABELS[s] || s;
  return `<span class="badge status-${s}"><span class="badge-dot"></span>${label}</span>`;
}

function priorityLabel(p) {
  if (!p) return "";
  return `<span class="priority-${p}">${PRIORITY_LABELS[p] || p}</span>`;
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtDateLong(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isOverdue(dateStr, status) {
  if (!dateStr || status === "completed" || status === "canceled") return false;
  return dateStr < todayISO();
}

let CURRENCY = "$";
function fmtMoney(n) {
  const v = Number(n || 0);
  return CURRENCY + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- Modal ----
function openModal(html) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal">${html}</div></div>`;
  document.getElementById("modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });
}
function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
