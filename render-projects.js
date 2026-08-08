const Projects = {
  async render() {
    const container = document.getElementById("view-projects");
    const [projects, tasks] = await Promise.all([
      DB.list("projects", { order: "created_at", ascending: false }),
      DB.list("tasks")
    ]);
    this._projects = projects;

    container.innerHTML = `
      <div class="grid grid-3">
        ${projects.length ? projects.map(p => {
          const projTasks = tasks.filter(t => t.project_id === p.id);
          const done = projTasks.filter(t => t.status === "completed").length;
          return `
          <div class="card" data-project="${p.id}" style="cursor:pointer">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
              <h3 style="font-size:15px">${p.name}</h3>
              ${statusBadge(p.status)}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${p.category || "No category"} ${p.end_date ? "· due " + fmtDate(p.end_date) : ""}</div>
            <div style="height:6px;border-radius:4px;background:var(--surface-2);margin-bottom:8px">
              <div style="height:100%;border-radius:4px;width:${p.progress || 0}%;background:var(--accent-purple)"></div>
            </div>
            <div style="font-size:12px;color:var(--text-muted)">${done}/${projTasks.length} tasks done · ${p.progress || 0}%</div>
          </div>`;
        }).join("") : `<div class="empty-state">No projects yet — add one to start planning.</div>`}
      </div>
    `;

    container.querySelectorAll("[data-project]").forEach(card => {
      card.addEventListener("click", () => this._openDetail(projects.find(p => p.id === card.dataset.project)));
    });
  },

  _openDetail(project) {
    openModal(`
      <h3>${project.name}</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-top:-8px">${project.description || "No description"}</p>
      <div class="field-row">
        <div class="field"><label>Status</label>
          <select id="f-status">${KANBAN_COLUMNS.map(s => `<option value="${s}" ${project.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}<option value="canceled" ${project.status === 'canceled' ? "selected" : ""}>Canceled</option></select>
        </div>
        <div class="field"><label>Progress %</label><input id="f-progress" type="number" min="0" max="100" value="${project.progress || 0}"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger" id="f-delete">Delete project</button>
        <button class="btn" id="f-edit-full">Edit details</button>
        <button class="btn btn-primary" id="f-board">Open task board →</button>
      </div>
    `);
    document.getElementById("f-board").onclick = () => {
      closeModal();
      App.switchView("tasks", project.name + " — Tasks");
      Tasks.render(project.id);
    };
    document.getElementById("f-delete").onclick = async () => {
      if (!confirm("Delete this project? Its tasks will be kept but unlinked.")) return;
      await DB.remove("projects", project.id);
      closeModal();
      this.render();
    };
    document.getElementById("f-edit-full").onclick = () => { closeModal(); this._openForm(project); };

    // quick status/progress save on change
    document.getElementById("f-status").onchange = async (e) => { await DB.update("projects", project.id, { status: e.target.value }); };
    document.getElementById("f-progress").onchange = async (e) => { await DB.update("projects", project.id, { progress: Number(e.target.value) }); };
  },

  openNew() { this._openForm(null); },

  async _openForm(project) {
    const isEdit = !!project;
    project = project || {};
    const [projCats, people] = await Promise.all([getPickList("project_category"), getPickList("person")]);
    openModal(`
      <h3>${isEdit ? "Edit project" : "New project"}</h3>
      <div class="field"><label>Name</label><input id="f-name" value="${project.name || ""}" placeholder="Project name"></div>
      <div class="field"><label>Description</label><textarea id="f-desc">${project.description || ""}</textarea></div>
      <div class="field-row">
        <div class="field"><label>Status</label>
          <select id="f-status">${KANBAN_COLUMNS.map(s => `<option value="${s}" ${project.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Priority</label>
          <select id="f-priority">${Object.entries(PRIORITY_LABELS).map(([k,v]) => `<option value="${k}" ${project.priority === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Start date</label><input id="f-start" type="date" value="${project.start_date || ""}"></div>
        <div class="field"><label>End date</label><input id="f-end" type="date" value="${project.end_date || ""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Category</label>${categorySelectHtml("f-category", projCats, project.category || "")}</div>
        <div class="field"><label>Person in charge</label>${categorySelectHtml("f-person", people, project.person_in_charge || "")}</div>
      </div>
      <div class="modal-actions">
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `);
    bindCategorySelect("f-category", "project_category");
    bindCategorySelect("f-person", "person");
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-save").onclick = async () => {
      const patch = {
        name: document.getElementById("f-name").value.trim(),
        description: document.getElementById("f-desc").value,
        status: document.getElementById("f-status").value,
        priority: document.getElementById("f-priority").value,
        start_date: document.getElementById("f-start").value || null,
        end_date: document.getElementById("f-end").value || null,
        category: document.getElementById("f-category").value,
        person_in_charge: document.getElementById("f-person").value
      };
      if (!patch.name) return alert("Give the project a name.");
      if (isEdit) await DB.update("projects", project.id, patch);
      else await DB.insert("projects", patch);
      closeModal();
      this.render();
    };
  }
};
