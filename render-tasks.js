const KANBAN_COLUMNS = ["to_do", "in_progress", "hold", "review", "completed"];

const Tasks = {
  mode: "list", // list | kanban
  scopeProjectId: null, // when opened from a project, filter to that project

  async render(projectId = null) {
    this.scopeProjectId = projectId;
    const container = document.getElementById("view-tasks");
    const [tasks, projects] = await Promise.all([
      DB.list("tasks", { order: "due_date" }),
      DB.list("projects", { order: "name" })
    ]);
    this._tasks = tasks;
    this._projects = projects;
    this._draw(container);
  },

  _draw(container) {
    const scoped = this.scopeProjectId
      ? this._tasks.filter(t => t.project_id === this.scopeProjectId)
      : this._tasks.filter(t => !t.project_id);

    container.innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${this.mode === 'list' ? 'active' : ''}" data-mode="list">List</button>
        <button class="tab-btn ${this.mode === 'kanban' ? 'active' : ''}" data-mode="kanban">Kanban</button>
        <button class="tab-btn ${this.mode === 'matrix' ? 'active' : ''}" data-mode="matrix">Decision matrix</button>
        <button class="tab-btn ${this.mode === 'gantt' ? 'active' : ''}" data-mode="gantt">Gantt</button>
      </div>
      <div id="tasks-body"></div>
    `;

    container.querySelectorAll(".tab-btn").forEach(b =>
      b.addEventListener("click", () => { this.mode = b.dataset.mode; this._draw(container); })
    );

    const body = document.getElementById("tasks-body");
    if (this.mode === "list") this._drawList(body, scoped);
    else if (this.mode === "kanban") this._drawKanban(body, scoped);
    else if (this.mode === "gantt") this._drawGantt(body, scoped);
    else this._drawMatrix(body, scoped);
  },

  _drawList(body, list) {
    body.innerHTML = `
      <div class="list">${
        list.length ? list.map(t => this._rowHtml(t)).join("") : `<div class="empty-state">No tasks yet. Add one to get started.</div>`
      }</div>
    `;
    this._bindRows(body);
  },

  _rowHtml(t) {
    const proj = this._projects.find(p => p.id === t.project_id);
    const status = isOverdue(t.due_date, t.status) ? "overdue" : (t.status || "to_do");
    return `
      <div class="row" data-open="${t.id}">
        <div class="row-check ${t.status === 'completed' ? 'checked' : ''}" data-check="${t.id}">✓</div>
        <div class="row-title ${t.status === 'completed' ? 'done' : ''}">${t.title}${proj ? ` <span style="color:var(--text-muted);font-weight:400">· ${proj.name}</span>` : ""}</div>
        <div class="row-meta">
          ${priorityLabel(t.priority)}
          ${t.due_date ? fmtDate(t.due_date) : ""}
          ${statusBadge(status)}
        </div>
      </div>`;
  },

  _bindRows(body) {
    body.querySelectorAll("[data-check]").forEach(chk => {
      chk.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = chk.dataset.check;
        const checked = chk.classList.contains("checked");
        await DB.update("tasks", id, { status: checked ? "to_do" : "completed", completed_at: checked ? null : new Date().toISOString() });
        this.render(this.scopeProjectId);
      });
    });
    body.querySelectorAll("[data-open]").forEach(row => {
      row.addEventListener("click", () => this._openForm(this._tasks.find(t => t.id === row.dataset.open)));
    });
  },

  _drawKanban(body, list) {
    body.innerHTML = `<div class="kanban">${KANBAN_COLUMNS.map(col => `
      <div class="kanban-col">
        <div class="kanban-col-title"><span>${STATUS_LABELS[col]}</span><span>${list.filter(t => (t.status || 'to_do') === col).length}</span></div>
        ${list.filter(t => (t.status || 'to_do') === col).map(t => `
          <div class="kanban-card" data-open="${t.id}">${t.title}</div>
        `).join("")}
      </div>
    `).join("")}</div>`;
    body.querySelectorAll("[data-open]").forEach(card => {
      card.addEventListener("click", () => this._openForm(this._tasks.find(t => t.id === card.dataset.open)));
    });
  },

  _drawGantt(body, list) {
    const items = list.filter(t => t.due_date || t.start_date);
    if (!items.length) { body.innerHTML = `<div class="empty-state">Add start/due dates to tasks to see them on the Gantt chart.</div>`; return; }
    const starts = items.map(t => new Date(t.start_date || t.due_date));
    const ends = items.map(t => new Date(t.due_date || t.start_date));
    const rangeStart = new Date(Math.min(...starts));
    const rangeEnd = new Date(Math.max(...ends));
    rangeStart.setDate(rangeStart.getDate() - 1);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    const totalDays = Math.max(1, Math.round((rangeEnd - rangeStart) / 86400000));

    const colors = ["var(--accent-blue)", "var(--accent-purple)", "var(--accent-teal)", "var(--accent-gold)", "var(--accent-pink)"];

    body.innerHTML = `
      <div class="card" style="overflow-x:auto">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">${fmtDate(rangeStart.toISOString().slice(0,10))} → ${fmtDate(rangeEnd.toISOString().slice(0,10))}</div>
        <div style="min-width:600px">
          ${items.map((t, i) => {
            const s = new Date(t.start_date || t.due_date);
            const e = new Date(t.due_date || t.start_date);
            const offset = Math.max(0, Math.round((s - rangeStart) / 86400000));
            const dur = Math.max(1, Math.round((e - s) / 86400000) + 1);
            const leftPct = (offset / totalDays) * 100;
            const widthPct = (dur / totalDays) * 100;
            return `
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="width:140px;font-size:12px;font-weight:500;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title}</div>
                <div style="flex:1;position:relative;height:20px;background:var(--surface-2);border-radius:5px">
                  <div style="position:absolute;left:${leftPct}%;width:${widthPct}%;height:100%;border-radius:5px;background:${colors[i % colors.length]}"></div>
                </div>
              </div>`;
          }).join("")}
        </div>
      </div>
    `;
  },

  _drawMatrix(body, list) {
    const quads = [
      { key: [true, true], title: "Urgent & important — do now", accent: "var(--accent-red)" },
      { key: [false, true], title: "Important, not urgent — decide when", accent: "var(--accent-blue)" },
      { key: [true, false], title: "Urgent, not important — delegate", accent: "var(--accent-gold)" },
      { key: [false, false], title: "Neither — delete / drop", accent: "var(--text-muted)" }
    ];
    body.innerHTML = `<div class="grid grid-2">${quads.map(q => {
      const items = list.filter(t => !!t.decision_urgent === q.key[0] && !!t.decision_important === q.key[1]);
      return `<div class="card">
        <div style="font-size:12px;font-weight:600;color:${q.accent};margin-bottom:10px">${q.title}</div>
        <div class="list">${items.length ? items.map(t => `<div class="row" data-open="${t.id}"><div class="row-title">${t.title}</div></div>`).join("") : `<div class="empty-state" style="padding:16px">Empty</div>`}</div>
      </div>`;
    }).join("")}</div>`;
    body.querySelectorAll("[data-open]").forEach(row => {
      row.addEventListener("click", () => this._openForm(list.find(t => t.id === row.dataset.open)));
    });
  },

  async _openForm(task) {
    const isEdit = !!task;
    task = task || {};
    const projectOptions = this._projects.map(p =>
      `<option value="${p.id}" ${task.project_id === p.id ? "selected" : ""}>${p.name}</option>`
    ).join("");
    const [taskCats, people] = await Promise.all([getPickList("task_category"), getPickList("person")]);

    openModal(`
      <h3>${isEdit ? "Edit task" : "New task"}</h3>
      <div class="field"><label>Title</label><input id="f-title" value="${task.title || ""}" placeholder="Task name"></div>
      <div class="field"><label>Description</label><textarea id="f-desc">${task.description || ""}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Status</label>
          <select id="f-status">${KANBAN_COLUMNS.map(s => `<option value="${s}" ${task.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}<option value="canceled" ${task.status === 'canceled' ? "selected" : ""}>Canceled</option></select>
        </div>
        <div class="field"><label>Priority</label>
          <select id="f-priority">${Object.entries(PRIORITY_LABELS).map(([k,v]) => `<option value="${k}" ${task.priority === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input id="f-start" type="date" value="${task.start_date || ""}"></div>
        <div class="field"><label>Due date</label><input id="f-due" type="date" value="${task.due_date || ""}"></div>
      </div>
      <div class="field"><label>Project (optional)</label><select id="f-project"><option value="">— None —</option>${projectOptions}</select></div>
      <div class="field-row">
        <div class="field"><label>Category</label>${categorySelectHtml("f-category", taskCats, task.category || "")}</div>
        <div class="field"><label>Person in charge</label>${categorySelectHtml("f-person", people, task.person_in_charge || "")}</div>
      </div>
      <div class="field-row">
        <div class="field"><label><input type="checkbox" id="f-urgent" ${task.decision_urgent ? "checked" : ""}> Urgent</label></div>
        <div class="field"><label><input type="checkbox" id="f-important" ${task.decision_important ? "checked" : ""}> Important</label></div>
      </div>
      <div class="modal-actions">
        ${isEdit ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : ""}
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `);
    document.getElementById("f-project").value = task.project_id || "";
    bindCategorySelect("f-category", "task_category");
    bindCategorySelect("f-person", "person");

    document.getElementById("f-cancel").onclick = closeModal;
    if (isEdit) document.getElementById("f-delete").onclick = async () => {
      await DB.remove("tasks", task.id);
      closeModal();
      this.render(this.scopeProjectId);
    };
    document.getElementById("f-save").onclick = async () => {
      const patch = {
        title: document.getElementById("f-title").value.trim(),
        description: document.getElementById("f-desc").value,
        status: document.getElementById("f-status").value,
        priority: document.getElementById("f-priority").value,
        start_date: document.getElementById("f-start").value || null,
        due_date: document.getElementById("f-due").value || null,
        project_id: document.getElementById("f-project").value || null,
        category: document.getElementById("f-category").value,
        person_in_charge: document.getElementById("f-person").value,
        decision_urgent: document.getElementById("f-urgent").checked,
        decision_important: document.getElementById("f-important").checked
      };
      if (!patch.title) return alert("Give the task a title.");
      if (isEdit) await DB.update("tasks", task.id, patch);
      else await DB.insert("tasks", patch);
      closeModal();
      this.render(this.scopeProjectId);
    };
  }
};
