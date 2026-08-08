const GOAL_CATEGORIES = ["Career", "Personal Growth", "Financial", "Health & Wellness", "Learning & Development", "Home & Environment", "Relationships", "Community & Social Impact"];

const Goals = {
  async render() {
    const container = document.getElementById("view-goals");
    const goals = await DB.list("goals", { order: "created_at", ascending: false });
    this._goals = goals;

    const byCategory = GOAL_CATEGORIES.map(cat => {
      const items = goals.filter(g => g.category === cat);
      const avg = items.length ? Math.round(items.reduce((s, g) => s + Number(g.progress || 0), 0) / items.length) : null;
      return { cat, items, avg };
    }).filter(c => c.items.length);
    const uncategorized = goals.filter(g => !GOAL_CATEGORIES.includes(g.category));

    container.innerHTML = `
      <div class="grid grid-2">
        ${byCategory.map(c => `
          <div class="card">
            <div style="display:flex;justify-content:space-between;margin-bottom:14px">
              <h3 style="font-size:14px">${c.cat}</h3>
              <span style="font-size:13px;font-weight:600;color:var(--accent-teal)">${c.avg}%</span>
            </div>
            <div class="list">
              ${c.items.map(g => `
                <div style="margin-bottom:12px" data-open="${g.id}">
                  <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;margin-bottom:6px;cursor:pointer">
                    <span>${g.title}</span><span style="color:var(--text-muted)">${g.progress || 0}%</span>
                  </div>
                  <div style="height:6px;border-radius:4px;background:var(--surface-2)"><div style="height:100%;border-radius:4px;width:${g.progress || 0}%;background:var(--accent-teal)"></div></div>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("")}
        ${uncategorized.length ? `<div class="card"><h3 style="font-size:14px;margin-bottom:14px">Other</h3><div class="list">${uncategorized.map(g => `
          <div data-open="${g.id}" style="margin-bottom:12px;cursor:pointer">
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;margin-bottom:6px"><span>${g.title}</span><span style="color:var(--text-muted)">${g.progress || 0}%</span></div>
            <div style="height:6px;border-radius:4px;background:var(--surface-2)"><div style="height:100%;border-radius:4px;width:${g.progress || 0}%;background:var(--accent-teal)"></div></div>
          </div>`).join("")}</div></div>` : ""}
      </div>
      ${!goals.length ? `<div class="empty-state">No goals yet — add your first one.</div>` : ""}
    `;

    container.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => this._form(goals.find(g => g.id === el.dataset.open))));
  },

  _form(g) {
    const isEdit = !!g; g = g || { progress: 0, status: "in_progress" };
    openModal(`
      <h3>${isEdit ? "Edit" : "New"} goal</h3>
      <div class="field"><label>Title</label><input id="f-title" value="${g.title || ""}"></div>
      <div class="field"><label>Description</label><textarea id="f-desc">${g.description || ""}</textarea></div>
      <div class="field"><label>Category</label><select id="f-cat">${GOAL_CATEGORIES.map(c => `<option value="${c}" ${g.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
      <div class="field-row">
        <div class="field"><label>Progress %</label><input id="f-progress" type="number" min="0" max="100" value="${g.progress || 0}"></div>
        <div class="field"><label>Target date</label><input id="f-date" type="date" value="${g.target_date || ""}"></div>
      </div>
      <div class="modal-actions">
        ${isEdit ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : ""}
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `);
    document.getElementById("f-cancel").onclick = closeModal;
    if (isEdit) document.getElementById("f-delete").onclick = async () => { await DB.remove("goals", g.id); closeModal(); Goals.render(); };
    document.getElementById("f-save").onclick = async () => {
      const patch = {
        title: document.getElementById("f-title").value.trim(),
        description: document.getElementById("f-desc").value,
        category: document.getElementById("f-cat").value,
        progress: Number(document.getElementById("f-progress").value || 0),
        target_date: document.getElementById("f-date").value || null
      };
      if (!patch.title) return alert("Give it a title.");
      if (isEdit) await DB.update("goals", g.id, patch); else await DB.insert("goals", patch);
      closeModal(); Goals.render();
    };
  }
};
