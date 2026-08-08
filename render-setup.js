const PICK_LIST_TYPES = [
  ["task_category", "Task categories"],
  ["project_category", "Project categories"],
  ["habit_category", "Habit categories"],
  ["grocery_category", "Grocery categories"],
  ["person", "People"]
];

const Setup = {
  tab: "general",

  async render() {
    const container = document.getElementById("view-setup");
    container.innerHTML = `
      <div class="tabs">
        <button class="tab-btn ${this.tab==='general'?'active':''}" data-tab="general">General</button>
        <button class="tab-btn ${this.tab==='categories'?'active':''}" data-tab="categories">Categories &amp; people</button>
        <button class="tab-btn ${this.tab==='fitness'?'active':''}" data-tab="fitness">Exercise library</button>
      </div>
      <div id="setup-body"></div>
    `;
    container.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this.tab = b.dataset.tab; this.render(); }));
    const body = document.getElementById("setup-body");
    if (this.tab === "general") this._general(body);
    else if (this.tab === "categories") this._categories(body);
    else this._fitness(body);
  },

  async _general(body) {
    const settings = await DB.getSettings();
    body.innerHTML = `
      <div class="card" style="max-width:420px">
        <div class="field"><label>Currency symbol</label><input id="f-currency" value="${settings.currency_symbol}" maxlength="3"></div>
        <div class="field"><label>Week starts on</label><select id="f-week"><option value="sunday" ${settings.week_start_day==='sunday'?'selected':''}>Sunday</option><option value="monday" ${settings.week_start_day==='monday'?'selected':''}>Monday</option></select></div>
        <div class="field"><label>Budget method</label><select id="f-budget"><option value="carry_over" ${settings.budget_method==='carry_over'?'selected':''}>Carry-over</option><option value="zero_based" ${settings.budget_method==='zero_based'?'selected':''}>Zero-based</option></select></div>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `;
    document.getElementById("f-save").onclick = async () => {
      await DB.updateSettings({
        currency_symbol: document.getElementById("f-currency").value || "$",
        week_start_day: document.getElementById("f-week").value,
        budget_method: document.getElementById("f-budget").value
      });
      alert("Saved.");
    };
  },

  async _categories(body) {
    const lists = {};
    for (const [type] of PICK_LIST_TYPES) lists[type] = await getPickList(type);

    body.innerHTML = `<div class="grid grid-3">
      ${PICK_LIST_TYPES.map(([type, label]) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="font-size:13px">${label}</h3>
            <button class="btn btn-sm" data-add="${type}">+ Add</button>
          </div>
          <div class="list">
            ${lists[type].length ? lists[type].map(item => `
              <div class="row" style="padding:8px 10px">
                <div class="row-title" style="font-size:13px">${item.label}</div>
                <button class="btn btn-sm btn-ghost" data-del="${item.id}">✕</button>
              </div>
            `).join("") : `<div class="empty-state" style="padding:14px">None yet</div>`}
          </div>
        </div>
      `).join("")}
    </div>`;

    body.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", async () => {
      const type = b.dataset.add;
      const label = prompt("New entry:");
      if (label && label.trim()) { await DB.insert("pick_lists", { list_type: type, label: label.trim() }); this.render(); }
    }));
    body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => { await DB.remove("pick_lists", b.dataset.del); this.render(); }));
  },

  async _fitness(body) {
    const [groups, exercises] = await Promise.all([DB.list("muscle_groups", { order: "sort_order" }), DB.list("exercises", { order: "name" })]);
    body.innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-sm" id="add-group">+ Add muscle group</button></div>
      <div class="grid grid-3">
        ${groups.map(g => `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <h3 style="font-size:13px">${g.name}</h3>
              <button class="btn btn-sm" data-add-ex="${g.id}">+ Exercise</button>
            </div>
            <div class="list">
              ${exercises.filter(e => e.muscle_group_id === g.id).map(e => `
                <div class="row" style="padding:8px 10px"><div class="row-title" style="font-size:13px">${e.name}</div><button class="btn btn-sm btn-ghost" data-del-ex="${e.id}">✕</button></div>
              `).join("") || `<div class="empty-state" style="padding:14px">No exercises yet</div>`}
            </div>
          </div>
        `).join("")}
      </div>
    `;
    document.getElementById("add-group").onclick = async () => {
      const name = prompt("Muscle group name:");
      if (name && name.trim()) { await DB.insert("muscle_groups", { name: name.trim() }); this.render(); }
    };
    body.querySelectorAll("[data-add-ex]").forEach(b => b.addEventListener("click", async () => {
      const name = prompt("Exercise name:");
      if (name && name.trim()) { await DB.insert("exercises", { muscle_group_id: b.dataset.addEx, name: name.trim() }); this.render(); }
    }));
    body.querySelectorAll("[data-del-ex]").forEach(b => b.addEventListener("click", async () => { await DB.remove("exercises", b.dataset.delEx); this.render(); }));
  }
};
