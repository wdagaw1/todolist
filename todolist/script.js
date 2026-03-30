const STORAGE_KEY = "todolist.v2";

/** @typedef {{ id: string; text: string; done: boolean; createdAt: number; dueAt?: number|null }} Todo */

const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const els = {
  form: /** @type {HTMLFormElement} */ ($("#todoForm")),
  input: /** @type {HTMLInputElement} */ ($("#todoInput")),
  due: /** @type {HTMLInputElement} */ ($("#todoDue")),
  list: /** @type {HTMLUListElement} */ ($("#todoList")),
  statTotal: $("#statTotal"),
  statDone: $("#statDone"),
  clearDone: /** @type {HTMLButtonElement} */ ($("#clearDone")),
  todayBtn: /** @type {HTMLButtonElement} */ ($("#todayBtn")),
  filterChips: /** @type {NodeListOf<HTMLButtonElement>} */ (
    document.querySelectorAll("[data-filter]")
  ),
  countdownValue: $("#countdownValue"),
  countdownMeta: $("#countdownMeta"),
  calTitle: $("#calTitle"),
  calGrid: $("#calGrid"),
  calPrev: /** @type {HTMLButtonElement} */ ($("#calPrev")),
  calNext: /** @type {HTMLButtonElement} */ ($("#calNext")),
  calHint: $("#calHint"),
  pinBtn: /** @type {HTMLButtonElement} */ ($("#pinBtn")),
  minBtn: /** @type {HTMLButtonElement} */ ($("#minBtn")),
  closeBtn: /** @type {HTMLButtonElement} */ ($("#closeBtn")),
  autoStart: /** @type {HTMLInputElement} */ ($("#autoStart"))
};

/** @type {Todo[]} */
let todos = [];
/** @type {"all" | "active" | "done"} */
let filter = "all";
/** @type {string|null} YYYY-MM-DD */
let selectedDay = null;
/** @type {Date} */
let calendarMonth = startOfMonth(new Date());
let countdownTimer = /** @type {number|null} */ (null);

function hasDesktopApi() {
  return typeof window !== "undefined" && typeof window.desktop !== "undefined";
}

async function initDesktopControls() {
  // Browser fallback: hide desktop-only controls, keep layout.
  if (!hasDesktopApi()) {
    els.autoStart.disabled = true;
    els.autoStart.checked = false;
    els.pinBtn.disabled = true;
    els.minBtn.disabled = true;
    els.closeBtn.disabled = true;
    els.pinBtn.title = "仅桌面版可用";
    return;
  }

  try {
    const isOnTop = await window.desktop.getAlwaysOnTop();
    els.pinBtn.classList.toggle("isOn", Boolean(isOnTop));
    els.pinBtn.setAttribute("aria-pressed", isOnTop ? "true" : "false");
  } catch {
    // ignore
  }

  try {
    const openAtLogin = await window.desktop.getOpenAtLogin();
    els.autoStart.checked = Boolean(openAtLogin);
  } catch {
    els.autoStart.checked = false;
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addDays(d, days) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(d, months) {
  return new Date(d.getFullYear(), d.getMonth() + months, 1, 0, 0, 0, 0);
}

function uid() {
  // Enough for a simple local app.
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("todolist.v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.text === "string")
      .map((t) => ({
        id: typeof t.id === "string" ? t.id : uid(),
        text: t.text.trim(),
        done: Boolean(t.done),
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        dueAt:
          typeof t.dueAt === "number"
            ? t.dueAt
            : t.dueAt == null
              ? null
              : typeof t.dueAt === "string"
                ? Date.parse(t.dueAt)
                : null,
      }))
      .filter((t) => t.text.length > 0);
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function fmtTime(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function fmtDue(ts) {
  if (ts == null) return "未设置截止";
  return `截止 · ${fmtTime(ts)}`;
}

function setFilter(next) {
  filter = next;
  for (const chip of els.filterChips) {
    const isActive = chip.dataset.filter === filter;
    chip.classList.toggle("isActive", isActive);
    chip.setAttribute("aria-selected", isActive ? "true" : "false");
  }
  render();
}

function getVisibleTodos() {
  let out = todos;
  if (filter === "active") out = out.filter((t) => !t.done);
  if (filter === "done") out = out.filter((t) => t.done);
  if (selectedDay) {
    out = out.filter((t) => {
      if (t.dueAt == null) return false;
      return ymd(new Date(t.dueAt)) === selectedDay;
    });
  }
  return out;
}

function updateStats() {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  els.statTotal.textContent = String(total);
  els.statDone.textContent = String(done);
  els.clearDone.disabled = done === 0;
}

function updateCalendarHint() {
  if (!selectedDay) {
    els.calHint.textContent = "未选择日期（显示全部任务）";
    return;
  }
  els.calHint.textContent = `已选择：${selectedDay}（显示该日截止的任务）`;
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  updateStats();
  renderCalendar();
  updateCountdown();
  const visible = getVisibleTodos();
  if (visible.length === 0) {
    els.list.innerHTML = `
      <li class="item" style="justify-content:center; text-align:center; grid-template-columns: 1fr;">
        <div class="content">
          <div class="text" style="color: rgba(255,255,255,0.72); font-weight: 600;">
            还没有任务
          </div>
          <div class="meta">${selectedDay ? "该日期暂无截止任务，可取消选择日期查看全部。" : "添加一个任务开始吧。"}</div>
        </div>
      </li>
    `;
    return;
  }

  els.list.innerHTML = visible
    .map((t) => {
      const safeText = escapeHtml(t.text);
      return `
        <li class="item ${t.done ? "isDone" : ""}" data-id="${t.id}">
          <input class="check" type="checkbox" ${t.done ? "checked" : ""} aria-label="完成任务" />
          <div class="content">
            <div class="text">${safeText}</div>
            <div class="meta">
              ${t.done ? "已完成" : "创建于"} · ${fmtTime(t.createdAt)}
              <span style="margin: 0 6px; opacity: .6;">·</span>
              ${t.dueAt != null ? fmtDue(t.dueAt) : "未设置截止"}
            </div>
          </div>
          <button class="trash" type="button" title="删除" aria-label="删除任务">🗑</button>
        </li>
      `;
    })
    .join("");
}

function parseDueInput(value) {
  const v = value.trim();
  if (!v) return null;
  const ts = Date.parse(v);
  return Number.isFinite(ts) ? ts : null;
}

function addTodo(text, dueAt) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.unshift({
    id: uid(),
    text: trimmed,
    done: false,
    createdAt: Date.now(),
    dueAt: dueAt ?? null,
  });
  saveTodos();
  render();
}

function toggleTodo(id, done) {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return;
  todos[idx] = { ...todos[idx], done };
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  render();
}

function clearDone() {
  const hasDone = todos.some((t) => t.done);
  if (!hasDone) return;
  todos = todos.filter((t) => !t.done);
  saveTodos();
  render();
}

function setSelectedDay(next) {
  selectedDay = next;
  updateCalendarHint();
  render();
}

function renderCalendar() {
  const month = calendarMonth;
  const year = month.getFullYear();
  const m = month.getMonth();
  els.calTitle.textContent = `${year} 年 ${m + 1} 月`;

  // Monday-first grid:
  // JS getDay(): Sun=0..Sat=6; we want Mon=0..Sun=6
  const first = new Date(year, m, 1);
  const firstDow = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -firstDow);

  const todayKey = ymd(new Date());
  const counts = new Map();
  for (const t of todos) {
    if (t.dueAt == null) continue;
    const key = ymd(new Date(t.dueAt));
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const key = ymd(d);
    const inMonth = d.getMonth() === m;
    const isToday = key === todayKey;
    const isSelected = selectedDay === key;
    const c = counts.get(key) || 0;
    cells.push(`
      <button
        class="day ${inMonth ? "" : "isOutside"} ${isToday ? "isToday" : ""} ${isSelected ? "isSelected" : ""}"
        type="button"
        data-day="${key}"
        role="gridcell"
        aria-label="${key}"
        aria-selected="${isSelected ? "true" : "false"}"
      >
        <span>${d.getDate()}</span>
        ${c > 0 ? `<span class="badge" aria-hidden="true">${c}</span>` : ""}
      </button>
    `);
  }
  els.calGrid.innerHTML = cells.join("");
  updateCalendarHint();
}

function nearestDueTodo() {
  const now = Date.now();
  const candidates = todos
    .filter((t) => !t.done && t.dueAt != null && Number.isFinite(t.dueAt))
    .sort((a, b) => /** @type {number} */ (a.dueAt) - /** @type {number} */ (b.dueAt));
  const next = candidates[0];
  if (!next) return null;
  const dueAt = /** @type {number} */ (next.dueAt);
  return { todo: next, dueAt, now };
}

function humanizeDelta(ms) {
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const ss = s % 60;
  const m = Math.floor(s / 60);
  const mm = m % 60;
  const h = Math.floor(m / 60);
  const hh = h % 24;
  const d = Math.floor(h / 24);
  const parts = [];
  if (d) parts.push(`${d}天`);
  parts.push(`${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`);
  return parts.join(" ");
}

function updateCountdown() {
  const next = nearestDueTodo();
  if (!next) {
    els.countdownValue.textContent = "—";
    els.countdownMeta.textContent = "暂无设置截止时间的未完成任务";
    return;
  }
  const delta = next.dueAt - next.now;
  if (delta >= 0) {
    els.countdownValue.textContent = humanizeDelta(delta);
    els.countdownMeta.textContent = `${next.todo.text}（${fmtTime(next.dueAt)}）`;
  } else {
    els.countdownValue.textContent = `已超时 ${humanizeDelta(delta)}`;
    els.countdownMeta.textContent = `${next.todo.text}（${fmtTime(next.dueAt)}）`;
  }
}

function startCountdownTicker() {
  if (countdownTimer != null) window.clearInterval(countdownTimer);
  countdownTimer = window.setInterval(() => updateCountdown(), 1000);
}

function wireEvents() {
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const dueAt = parseDueInput(els.due.value);
    addTodo(els.input.value, dueAt);
    els.input.value = "";
    els.due.value = "";
    els.input.focus();
  });

  for (const chip of els.filterChips) {
    chip.addEventListener("click", () => setFilter(chip.dataset.filter || "all"));
  }

  els.clearDone.addEventListener("click", () => clearDone());
  els.todayBtn.addEventListener("click", () => {
    const today = ymd(new Date());
    calendarMonth = startOfMonth(new Date());
    setSelectedDay(today);
  });

  els.calPrev.addEventListener("click", () => {
    calendarMonth = addMonths(calendarMonth, -1);
    render();
  });
  els.calNext.addEventListener("click", () => {
    calendarMonth = addMonths(calendarMonth, 1);
    render();
  });

  els.calGrid.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const btn = target.closest("[data-day]");
    if (!btn) return;
    const day = btn.getAttribute("data-day");
    if (!day) return;
    setSelectedDay(selectedDay === day ? null : day);
    // If user picked a day, pre-fill due date to that day (keep time blank).
    if (selectedDay) {
      els.due.value = `${selectedDay}T09:00`;
    }
  });

  // Desktop window controls (Electron)
  els.minBtn.addEventListener("click", async () => {
    if (!hasDesktopApi()) return;
    await window.desktop.minimize();
  });
  els.closeBtn.addEventListener("click", async () => {
    if (!hasDesktopApi()) return;
    await window.desktop.close();
  });
  els.pinBtn.addEventListener("click", async () => {
    if (!hasDesktopApi()) return;
    const next = !els.pinBtn.classList.contains("isOn");
    const actual = await window.desktop.setAlwaysOnTop(next);
    els.pinBtn.classList.toggle("isOn", Boolean(actual));
    els.pinBtn.setAttribute("aria-pressed", actual ? "true" : "false");
  });
  els.autoStart.addEventListener("change", async () => {
    if (!hasDesktopApi()) return;
    const actual = await window.desktop.setOpenAtLogin(els.autoStart.checked);
    els.autoStart.checked = Boolean(actual);
  });

  els.list.addEventListener("click", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    const item = target.closest("[data-id]");
    if (!item) return;
    const id = item.getAttribute("data-id");
    if (!id) return;

    if (target.classList.contains("trash")) {
      deleteTodo(id);
    }
  });

  els.list.addEventListener("change", (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.classList.contains("check")) return;
    const item = target.closest("[data-id]");
    if (!item) return;
    const id = item.getAttribute("data-id");
    if (!id) return;
    toggleTodo(id, target.checked);
  });
}

function init() {
  todos = loadTodos();
  calendarMonth = startOfMonth(new Date());
  wireEvents();
  setFilter("all");
  startCountdownTicker();
  initDesktopControls();
  els.input.focus();
}

init();

