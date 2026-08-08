const Calendar = {
  cursor: new Date(),
  mode: "month", // month | day
  selectedDate: todayISO(),

  async render() {
    const container = document.getElementById("view-calendar");
    const [tasks, projects, events, bh, tx, blocks, meals] = await Promise.all([
      DB.list("tasks"),
      DB.list("projects"),
      DB.list("calendar_events"),
      DB.list("birthdays_holidays"),
      DB.list("budget_transactions"),
      DB.list("time_blocks"),
      DB.list("meals")
    ]);
    this._data = { tasks, projects, events, bh, tx, blocks, meals };
    if (this.mode === "day") this._drawDay(container);
    else this._draw(container);
  },

  _topActions() {
    return `
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" id="cal-manage-bh">Birthdays &amp; holidays</button>
        <button class="btn btn-sm btn-primary" id="cal-add-event">+ Event</button>
      </div>`;
  },

  _bindTopActions(container) {
    const bh = container.querySelector("#cal-manage-bh");
    const ev = container.querySelector("#cal-add-event");
    if (bh) bh.onclick = () => this._manageBirthdays();
    if (ev) ev.onclick = () => this._eventForm(this.selectedDate);
  },

  _draw(container) {
    const year = this.cursor.getFullYear();
    const month = this.cursor.getMonth();
    const monthName = this.cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const firstOfMonth = new Date(year, month, 1);
    const startDow = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = startDow - 1; i >= 0; i--) cells.push({ day: daysInPrevMonth - i, other: true, date: new Date(year, month - 1, daysInPrevMonth - i) });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, other: false, date: new Date(year, month, d) });
    while (cells.length % 7 !== 0) {
      const idx = cells.length - (startDow + daysInMonth);
      cells.push({ day: idx + 1, other: true, date: new Date(year, month + 1, cells.length - startDow - daysInMonth + 1) });
    }

    const todayStr = todayISO();
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    container.innerHTML = `
      <div class="calendar-nav" style="justify-content:space-between;margin-bottom:16px">
        <div class="calendar-nav"><button class="btn btn-sm" id="cal-prev">← Prev</button><h2>${monthName}</h2><button class="btn btn-sm" id="cal-next">Next →</button></div>
        ${this._topActions()}
      </div>
      <div class="calendar-grid">
        ${dow.map(d => `<div class="calendar-dow">${d}</div>`).join("")}
        ${cells.map(c => this._cellHtml(c, todayStr)).join("")}
      </div>
    `;

    document.getElementById("cal-prev").onclick = () => { this.cursor = new Date(year, month - 1, 1); this._draw(container); };
    document.getElementById("cal-next").onclick = () => { this.cursor = new Date(year, month + 1, 1); this._draw(container); };
    this._bindTopActions(container);
    container.querySelectorAll("[data-cell]").forEach(cell => cell.addEventListener("click", () => {
      this.selectedDate = cell.dataset.cell;
      this.mode = "day";
      this._drawDay(container);
    }));
  },

  _eventsForDate(iso) {
    const { tasks, projects, events, bh, tx } = this._data;
    const items = [];
    tasks.forEach(t => { if (t.due_date === iso) items.push({ label: t.title, color: "var(--accent-blue)" }); });
    projects.forEach(p => { if (p.end_date === iso) items.push({ label: p.name + " due", color: "var(--accent-purple)" }); });
    events.forEach(e => { if (e.event_date === iso) items.push({ label: e.title, color: "var(--accent-teal)" }); });
    bh.forEach(b => {
      const bDate = new Date(b.event_date + "T00:00:00");
      const target = new Date(iso + "T00:00:00");
      const match = b.is_recurring_yearly
        ? (bDate.getMonth() === target.getMonth() && bDate.getDate() === target.getDate())
        : b.event_date === iso;
      if (match) items.push({ label: b.name, color: "var(--accent-pink)" });
    });
    tx.forEach(t => { if (t.transaction_date === iso) items.push({ label: (t.transaction_type === 'income' ? '+' : '-') + fmtMoney(t.amount), color: "var(--accent-gold)" }); });
    return items;
  },

  _cellHtml(c, todayStr) {
    const iso = c.date.toISOString().slice(0, 10);
    const items = this._eventsForDate(iso);
    return `
      <div class="calendar-cell ${c.other ? "other-month" : ""} ${iso === todayStr ? "today" : ""}" data-cell="${iso}" style="cursor:pointer">
        <div class="calendar-date">${c.day}</div>
        ${items.slice(0, 3).map(i => `<div class="calendar-event" style="background:${i.color}22;color:${i.color}">${i.label}</div>`).join("")}
        ${items.length > 3 ? `<div style="font-size:10px;color:var(--text-muted)">+${items.length - 3} more</div>` : ""}
      </div>`;
  },

  // ---- DAY VIEW / TIME BLOCKING ----
  _drawDay(container) {
    const { tasks, meals, blocks } = this._data;
    const iso = this.selectedDate;
    const dayTasks = tasks.filter(t => t.due_date === iso);
    const dayMeals = meals.filter(m => m.meal_date === iso);
    const dayBlocks = blocks.filter(b => b.block_date === iso).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

    container.innerHTML = `
      <div class="calendar-nav" style="justify-content:space-between;margin-bottom:16px">
        <div class="calendar-nav"><button class="btn btn-sm" id="day-back">← Month</button><h2>${fmtDateLong(iso)}</h2></div>
        ${this._topActions()}
      </div>
      <div class="grid grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Time blocks <button class="btn btn-sm" id="add-block">+ Add</button></div>
          <div class="list">${dayBlocks.length ? dayBlocks.map(b => `
            <div class="row"><div class="row-title">${b.label || "(untitled)"}</div><div class="row-meta">${b.start_time || ""}${b.end_time ? " – " + b.end_time : ""}</div></div>
          `).join("") : `<div class="empty-state">Nothing scheduled.</div>`}</div>
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Tasks due</div>
          <div class="list">${dayTasks.length ? dayTasks.map(t => `<div class="row">${statusBadge(t.status)}<div class="row-title">${t.title}</div></div>`).join("") : `<div class="empty-state">None due.</div>`}</div>
          <div class="section-title">Meals</div>
          <div class="list">${dayMeals.length ? dayMeals.map(m => `<div class="row"><div class="row-title">${m.description || m.meal_type}</div><div class="row-meta">${m.meal_type}</div></div>`).join("") : `<div class="empty-state">Nothing planned.</div>`}</div>
        </div>
      </div>
    `;
    document.getElementById("day-back").onclick = () => { this.mode = "month"; this._draw(container); };
    document.getElementById("add-block").onclick = () => this._blockForm(iso);
    this._bindTopActions(container);
  },

  _blockForm(date) {
    openModal(`<h3>New time block</h3>
      <div class="field"><label>Label</label><input id="f-label" placeholder="e.g. Deep work"></div>
      <div class="field-row"><div class="field"><label>Start</label><input id="f-start" type="time"></div><div class="field"><label>End</label><input id="f-end" type="time"></div></div>
      <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-save").onclick = async () => {
      await DB.insert("time_blocks", { block_date: date, label: document.getElementById("f-label").value, start_time: document.getElementById("f-start").value || null, end_time: document.getElementById("f-end").value || null });
      closeModal(); Calendar.render();
    };
  },

  _eventForm(date) {
    openModal(`<h3>New event</h3>
      <div class="field"><label>Title</label><input id="f-title"></div>
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${date}"></div>
      <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-save").onclick = async () => {
      const title = document.getElementById("f-title").value.trim();
      if (!title) return alert("Give it a title.");
      await DB.insert("calendar_events", { title, event_date: document.getElementById("f-date").value });
      closeModal(); Calendar.render();
    };
  },

  async _manageBirthdays() {
    const bh = await DB.list("birthdays_holidays", { order: "event_date" });
    openModal(`
      <h3>Birthdays &amp; holidays</h3>
      <div class="list" style="margin-bottom:16px;max-height:220px;overflow-y:auto">
        ${bh.length ? bh.map(b => `<div class="row"><div class="row-title">${b.name}</div><div class="row-meta">${fmtDate(b.event_date)} · ${b.event_type}</div><button class="btn btn-sm btn-ghost" data-del="${b.id}">Remove</button></div>`).join("") : `<div class="empty-state">None yet.</div>`}
      </div>
      <div class="field"><label>Name</label><input id="f-name"></div>
      <div class="field-row">
        <div class="field"><label>Date</label><input id="f-date" type="date"></div>
        <div class="field"><label>Type</label><select id="f-type"><option value="birthday">Birthday</option><option value="holiday">Holiday</option></select></div>
      </div>
      <div class="modal-actions"><button class="btn" id="f-cancel">Close</button><button class="btn btn-primary" id="f-save">Add</button></div>
    `);
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-save").onclick = async () => {
      const name = document.getElementById("f-name").value.trim();
      const event_date = document.getElementById("f-date").value;
      if (!name || !event_date) return alert("Name and date needed.");
      await DB.insert("birthdays_holidays", { name, event_date, event_type: document.getElementById("f-type").value });
      closeModal(); this._manageBirthdays();
    };
    document.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => { await DB.remove("birthdays_holidays", b.dataset.del); closeModal(); this._manageBirthdays(); }));
  }
};
