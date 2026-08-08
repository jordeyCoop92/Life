const Chores = {
  async render() {
    const container = document.getElementById("view-chores");
    const chores = await DB.list("chores", { order: "next_due" });
    this._chores = chores;
    container.innerHTML = `
      <div class="list">${chores.length ? chores.map(c => {
        const overdue = c.next_due && c.next_due < todayISO();
        return `<div class="row">
          <div class="row-check ${false ? "checked" : ""}" data-done="${c.id}">✓</div>
          <div class="row-title">${c.name} <span style="color:var(--text-muted);font-weight:400">· ${c.frequency}${c.assigned_to ? " · " + c.assigned_to : ""}</span></div>
          <div class="row-meta">${c.next_due ? (overdue ? `<span style="color:var(--accent-red)">overdue ${fmtDate(c.next_due)}</span>` : "due " + fmtDate(c.next_due)) : ""}</div>
          <button class="btn btn-sm btn-ghost" data-edit="${c.id}">Edit</button>
        </div>`;
      }).join("") : `<div class="empty-state">No chores yet.</div>`}</div>
    `;
    container.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => this._form(chores.find(c => c.id === b.dataset.edit))));
    container.querySelectorAll("[data-done]").forEach(b => b.addEventListener("click", async () => {
      const c = chores.find(x => x.id === b.dataset.done);
      const next = new Date();
      const days = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30 }[c.frequency] || 7;
      next.setDate(next.getDate() + days);
      await DB.update("chores", c.id, { last_completed: todayISO(), next_due: next.toISOString().slice(0, 10) });
      this.render();
    }));
  },

  async _form(c) {
    const isEdit = !!c; c = c || { frequency: "weekly" };
    const people = await getPickList("person");
    openModal(`
      <h3>${isEdit ? "Edit" : "New"} chore</h3>
      <div class="field"><label>Name</label><input id="f-name" value="${c.name || ""}"></div>
      <div class="field-row">
        <div class="field"><label>Frequency</label><select id="f-freq">
          <option value="daily" ${c.frequency==='daily'?'selected':''}>Daily</option>
          <option value="weekly" ${c.frequency==='weekly'?'selected':''}>Weekly</option>
          <option value="fortnightly" ${c.frequency==='fortnightly'?'selected':''}>Fortnightly</option>
          <option value="monthly" ${c.frequency==='monthly'?'selected':''}>Monthly</option>
        </select></div>
        <div class="field"><label>Assigned to</label>${categorySelectHtml("f-assigned", people, c.assigned_to || "")}</div>
      </div>
      <div class="field"><label>Next due</label><input id="f-due" type="date" value="${c.next_due || todayISO()}"></div>
      <div class="modal-actions">
        ${isEdit ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : ""}
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `);
    bindCategorySelect("f-assigned", "person");
    document.getElementById("f-cancel").onclick = closeModal;
    if (isEdit) document.getElementById("f-delete").onclick = async () => { await DB.remove("chores", c.id); closeModal(); Chores.render(); };
    document.getElementById("f-save").onclick = async () => {
      const name = document.getElementById("f-name").value.trim();
      if (!name) return alert("Name it.");
      const patch = { name, frequency: document.getElementById("f-freq").value, assigned_to: document.getElementById("f-assigned").value, next_due: document.getElementById("f-due").value || null };
      if (isEdit) await DB.update("chores", c.id, patch); else await DB.insert("chores", patch);
      closeModal(); Chores.render();
    };
  }
};
