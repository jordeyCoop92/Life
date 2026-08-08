function weekDates(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1) + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

const Wellness = {
  tab: "habits",

  async render() {
    const container = document.getElementById("view-wellness");
    container.innerHTML = `
      <div class="tabs">
        ${[["habits","Habits"],["fitness","Fitness"],["meals","Meals"],["grocery","Grocery"],["hydration","Hydration"],["weight","Weight"]]
          .map(([k,l]) => `<button class="tab-btn ${this.tab===k?"active":""}" data-tab="${k}">${l}</button>`).join("")}
      </div>
      <div id="wellness-body"></div>
    `;
    container.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this.tab = b.dataset.tab; this.render(); }));
    const body = document.getElementById("wellness-body");
    if (this.tab === "habits") this._habits(body);
    else if (this.tab === "fitness") this._fitness(body);
    else if (this.tab === "meals") this._meals(body);
    else if (this.tab === "grocery") this._grocery(body);
    else if (this.tab === "hydration") this._hydration(body);
    else if (this.tab === "weight") this._weight(body);
  },

  // ---- HABITS ----
  async _habits(body) {
    const [habits, logs] = await Promise.all([DB.list("habits", { order: "created_at" }), DB.list("habit_logs")]);
    const days = weekDates();
    const dow = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    body.innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-primary" id="add-habit">+ New habit</button></div>
      <div class="card" style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;font-size:12px;color:var(--text-muted);padding:6px"></th>
            ${days.map((d,i) => `<th style="font-size:11px;color:var(--text-muted);padding:6px;text-align:center">${dow[i]}<br>${fmtDate(d)}</th>`).join("")}
          </tr></thead>
          <tbody>
            ${habits.map(h => `<tr>
              <td style="padding:8px 6px;font-size:13px;font-weight:500;white-space:nowrap">${h.name}</td>
              ${days.map(d => {
                const done = logs.some(l => l.habit_id === h.id && l.log_date === d && l.completed);
                return `<td style="text-align:center;padding:6px"><div class="row-check ${done ? "checked" : ""}" data-habit="${h.id}" data-date="${d}" style="margin:0 auto">✓</div></td>`;
              }).join("")}
            </tr>`).join("")}
          </tbody>
        </table>
        ${!habits.length ? `<div class="empty-state">No habits yet.</div>` : ""}
      </div>
    `;
    document.getElementById("add-habit").onclick = async () => {
      const cats = await getPickList("habit_category");
      openModal(`<h3>New habit</h3><div class="field"><label>Name</label><input id="f-name"></div><div class="field"><label>Category</label>${categorySelectHtml("f-cat", cats, "")}</div><div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
      bindCategorySelect("f-cat", "habit_category");
      document.getElementById("f-cancel").onclick = closeModal;
      document.getElementById("f-save").onclick = async () => {
        const name = document.getElementById("f-name").value.trim();
        if (!name) return alert("Name it.");
        await DB.insert("habits", { name, category: document.getElementById("f-cat").value });
        closeModal(); Wellness.render();
      };
    };
    body.querySelectorAll("[data-habit]").forEach(cell => cell.addEventListener("click", async () => {
      const habitId = cell.dataset.habit, date = cell.dataset.date;
      const existing = logs.find(l => l.habit_id === habitId && l.log_date === date);
      if (existing) await DB.update("habit_logs", existing.id, { completed: !existing.completed });
      else await DB.insert("habit_logs", { habit_id: habitId, log_date: date, completed: true });
      Wellness.render();
    }));
  },

  // ---- FITNESS ----
  async _fitness(body) {
    const [workouts, groups, exercises] = await Promise.all([
      DB.list("workouts", { order: "workout_date", ascending: false }),
      DB.list("muscle_groups", { order: "sort_order" }),
      DB.list("exercises", { order: "name" })
    ]);
    const exerciseName = (id) => exercises.find(e => e.id === id)?.name || "";
    body.innerHTML = `
      <div style="margin-bottom:14px;display:flex;gap:8px">
        <button class="btn btn-primary" id="add-workout">+ Log workout</button>
        <button class="btn" id="manage-exercises">Manage exercise library</button>
      </div>
      <div class="list">${workouts.length ? workouts.map(w => `
        <div class="row">
          <div class="row-title">${w.exercise_id ? exerciseName(w.exercise_id) : w.exercise} <span style="color:var(--text-muted);font-weight:400">· ${w.muscle_group || ""}</span></div>
          <div class="row-meta">${w.sets || "-"}×${w.reps || "-"} ${w.weight ? "@ " + w.weight : ""} · ${fmtDate(w.workout_date)}</div>
        </div>`).join("") : `<div class="empty-state">No workouts logged yet.</div>`}</div>
    `;
    document.getElementById("manage-exercises").onclick = () => { App.switchView("setup"); Setup.tab = "fitness"; Setup.render(); };
    document.getElementById("add-workout").onclick = () => {
      openModal(`<h3>Log workout</h3>
        <div class="field-row">
          <div class="field"><label>Muscle group</label><select id="f-mg">${groups.map(g => `<option value="${g.id}">${g.name}</option>`).join("")}</select></div>
          <div class="field"><label>Exercise</label><select id="f-ex"></select></div>
        </div>
        <div class="field-row"><div class="field"><label>Sets</label><input id="f-sets" type="number"></div><div class="field"><label>Reps</label><input id="f-reps" type="number"></div><div class="field"><label>Weight</label><input id="f-weight" type="number" step="0.5"></div></div>
        <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
        <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
      const mgSelect = document.getElementById("f-mg");
      const exSelect = document.getElementById("f-ex");
      const populateExercises = () => {
        const groupExercises = exercises.filter(e => e.muscle_group_id === mgSelect.value);
        exSelect.innerHTML = groupExercises.map(e => `<option value="${e.id}">${e.name}</option>`).join("") + `<option value="__add_new__">+ Add new…</option>`;
      };
      populateExercises();
      mgSelect.addEventListener("change", populateExercises);
      exSelect.addEventListener("change", async () => {
        if (exSelect.value !== "__add_new__") return;
        const name = prompt("New exercise name:");
        if (name && name.trim()) {
          const row = await DB.insert("exercises", { muscle_group_id: mgSelect.value, name: name.trim() });
          exercises.push(row);
          populateExercises();
          exSelect.value = row.id;
        } else exSelect.selectedIndex = 0;
      });
      document.getElementById("f-cancel").onclick = closeModal;
      document.getElementById("f-save").onclick = async () => {
        const groupName = groups.find(g => g.id === mgSelect.value)?.name || "";
        await DB.insert("workouts", {
          exercise_id: exSelect.value !== "__add_new__" ? exSelect.value : null,
          muscle_group: groupName,
          sets: Number(document.getElementById("f-sets").value || 0),
          reps: Number(document.getElementById("f-reps").value || 0),
          weight: Number(document.getElementById("f-weight").value || 0),
          workout_date: document.getElementById("f-date").value
        });
        closeModal(); Wellness.render();
      };
    };
  },

  // ---- MEALS ----
  async _meals(body) {
    const meals = await DB.list("meals", { order: "meal_date", ascending: false });
    const today = todayISO();
    const todayMeals = meals.filter(m => m.meal_date === today);
    const upcoming = meals.filter(m => m.meal_date > today).sort((a,b) => a.meal_date.localeCompare(b.meal_date));
    const rowsHtml = (list) => list.length ? list.map(m => `
      <div class="row"><div class="row-title">${m.description || "(no description)"} <span style="color:var(--text-muted);font-weight:400">· ${m.meal_type}</span></div><div class="row-meta">${fmtDate(m.meal_date)}</div></div>
    `).join("") : `<div class="empty-state">Nothing planned</div>`;

    body.innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-primary" id="add-meal">+ Add meal</button></div>
      <div class="section-title" style="margin-top:0">Today</div>
      <div class="list">${rowsHtml(todayMeals)}</div>
      <div class="section-title">Meal planner (upcoming)</div>
      <div class="list">${rowsHtml(upcoming.slice(0, 10))}</div>
    `;
    document.getElementById("add-meal").onclick = () => {
      openModal(`<h3>Add meal</h3>
        <div class="field-row"><div class="field"><label>Type</label><select id="f-type"><option>breakfast</option><option>lunch</option><option>dinner</option><option>snack</option></select></div><div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div></div>
        <div class="field"><label>Description</label><input id="f-desc" placeholder="What's on the menu"></div>
        <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
      document.getElementById("f-cancel").onclick = closeModal;
      document.getElementById("f-save").onclick = async () => {
        await DB.insert("meals", { meal_type: document.getElementById("f-type").value, meal_date: document.getElementById("f-date").value, description: document.getElementById("f-desc").value });
        closeModal(); Wellness.render();
      };
    };
  },

  // ---- GROCERY ----
  async _grocery(body) {
    const list = await DB.list("grocery_items", { order: "created_at" });
    body.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input id="quick-add" placeholder="Add an item and press Enter" style="flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-size:13px">
        <button class="btn" id="detailed-add">+ With category</button>
      </div>
      <div class="list">${list.length ? list.map(i => `
        <div class="row">
          <div class="row-check ${i.is_checked ? "checked" : ""}" data-check="${i.id}">✓</div>
          <div class="row-title ${i.is_checked ? "done" : ""}">${i.name}${i.category ? ` <span style="color:var(--text-muted);font-weight:400">· ${i.category}</span>` : ""}${i.quantity ? ` <span style="color:var(--text-muted);font-weight:400">· ${i.quantity}</span>` : ""}</div>
          <button class="btn btn-sm btn-ghost" data-del="${i.id}">Remove</button>
        </div>`).join("") : `<div class="empty-state">List is empty.</div>`}</div>
    `;
    document.getElementById("quick-add").addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        await DB.insert("grocery_items", { name: e.target.value.trim() });
        Wellness.render();
      }
    });
    document.getElementById("detailed-add").onclick = async () => {
      const cats = await getPickList("grocery_category");
      openModal(`<h3>New grocery item</h3>
        <div class="field"><label>Item</label><input id="f-name"></div>
        <div class="field-row"><div class="field"><label>Category</label>${categorySelectHtml("f-cat", cats, "")}</div><div class="field"><label>Quantity</label><input id="f-qty" placeholder="e.g. 2"></div></div>
        <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
      bindCategorySelect("f-cat", "grocery_category");
      document.getElementById("f-cancel").onclick = closeModal;
      document.getElementById("f-save").onclick = async () => {
        const name = document.getElementById("f-name").value.trim();
        if (!name) return alert("Name the item.");
        await DB.insert("grocery_items", { name, category: document.getElementById("f-cat").value, quantity: document.getElementById("f-qty").value });
        closeModal(); Wellness.render();
      };
    };
    body.querySelectorAll("[data-check]").forEach(c => c.addEventListener("click", async () => {
      const item = list.find(i => i.id === c.dataset.check);
      await DB.update("grocery_items", item.id, { is_checked: !item.is_checked });
      Wellness.render();
    }));
    body.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", async () => { await DB.remove("grocery_items", b.dataset.del); Wellness.render(); }));
  },

  // ---- HYDRATION ----
  async _hydration(body) {
    const logs = await DB.list("hydration_logs", { order: "log_date", ascending: false });
    const today = todayISO();
    const todayTotal = logs.filter(l => l.log_date === today).reduce((s, l) => s + l.amount_ml, 0);
    body.innerHTML = `
      <div class="card" style="margin-bottom:18px">
        <div class="stat-label">Today</div>
        <div class="stat-value">${todayTotal} ml</div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn" data-add="250">+250ml</button>
          <button class="btn" data-add="500">+500ml</button>
          <button class="btn" data-add="750">+750ml</button>
        </div>
      </div>
      <div class="section-title" style="margin-top:0">History</div>
      <div class="list">${logs.length ? [...new Set(logs.map(l=>l.log_date))].slice(0,14).map(d => {
        const total = logs.filter(l => l.log_date === d).reduce((s,l)=>s+l.amount_ml,0);
        return `<div class="row"><div class="row-title">${fmtDate(d)}</div><div class="row-meta">${total} ml</div></div>`;
      }).join("") : `<div class="empty-state">No entries yet.</div>`}</div>
    `;
    body.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", async () => {
      await DB.insert("hydration_logs", { log_date: today, amount_ml: Number(b.dataset.add) });
      Wellness.render();
    }));
  },

  // ---- WEIGHT ----
  async _weight(body) {
    const logs = await DB.list("weight_logs", { order: "log_date", ascending: false });
    body.innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-primary" id="add-weight">+ Log weight</button></div>
      <div class="list">${logs.length ? logs.map(w => `<div class="row"><div class="row-title">${w.weight} ${w.unit}</div><div class="row-meta">${fmtDate(w.log_date)}</div></div>`).join("") : `<div class="empty-state">No entries yet.</div>`}</div>
    `;
    document.getElementById("add-weight").onclick = () => {
      openModal(`<h3>Log weight</h3>
        <div class="field-row"><div class="field"><label>Weight</label><input id="f-weight" type="number" step="0.1"></div><div class="field"><label>Unit</label><select id="f-unit"><option value="kg">kg</option><option value="lb">lb</option></select></div></div>
        <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
        <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
      document.getElementById("f-cancel").onclick = closeModal;
      document.getElementById("f-save").onclick = async () => {
        const weight = Number(document.getElementById("f-weight").value);
        if (!weight) return alert("Enter a weight.");
        await DB.insert("weight_logs", { weight, unit: document.getElementById("f-unit").value, log_date: document.getElementById("f-date").value });
        closeModal(); Wellness.render();
      };
    };
  }
};
