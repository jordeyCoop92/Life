const Dashboard = {
  async render() {
    const container = document.getElementById("view-dashboard");
    container.innerHTML = `<div class="empty-state">Loading…</div>`;

    const today = todayISO();
    const thisMonth = today.slice(0, 7);
    const [tasks, projects, txs, cats, goals, habits, habitLogs, workouts, meals, subs, debts, bh, chores, blocks, settings] = await Promise.all([
      DB.list("tasks", { order: "due_date" }),
      DB.list("projects", { order: "created_at" }),
      DB.list("budget_transactions", { order: "transaction_date", ascending: false }),
      DB.list("budget_categories"),
      DB.list("goals"),
      DB.list("habits"),
      DB.list("habit_logs"),
      DB.list("workouts"),
      DB.list("meals"),
      DB.list("subscriptions"),
      DB.list("debts"),
      DB.list("birthdays_holidays"),
      DB.list("chores"),
      DB.list("time_blocks"),
      DB.getSettings()
    ]);
    CURRENCY = settings.currency_symbol || "$";

    const openTasks = tasks.filter(t => t.status !== "completed" && t.status !== "canceled");
    const dueToday = openTasks.filter(t => t.due_date === today);
    const overdue = openTasks.filter(t => isOverdue(t.due_date, t.status));
    const mainTask = dueToday.sort((a, b) => (a.priority || "").localeCompare(b.priority || ""))[0];
    const activeProjects = projects.filter(p => p.status !== "completed" && p.status !== "canceled");

    const monthTx = txs.filter(t => (t.transaction_date || "").startsWith(thisMonth));
    const income = monthTx.filter(t => t.transaction_type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = monthTx.filter(t => t.transaction_type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const plannedTotal = cats.filter(c => c.group_type !== "income").reduce((s, c) => s + Number(c.planned_amount), 0);

    const goalCats = typeof GOAL_CATEGORIES !== "undefined" ? GOAL_CATEGORIES : [];
    const goalByCategory = goalCats.map(cat => {
      const items = goals.filter(g => g.category === cat);
      const avg = items.length ? Math.round(items.reduce((s, g) => s + Number(g.progress || 0), 0) / items.length) : null;
      return { cat, avg };
    }).filter(c => c.avg !== null);

    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoIso = weekAgo.toISOString().slice(0, 10);
    const habitLogsThisWeek = habitLogs.filter(l => l.log_date >= weekAgoIso && l.completed);
    const habitPossible = habits.length * 7;
    const habitPct = habitPossible ? Math.round((habitLogsThisWeek.length / habitPossible) * 100) : 0;

    const todayMeals = meals.filter(m => m.meal_date === today);
    const mealFor = (type) => todayMeals.find(m => m.meal_type === type);
    const todayWorkouts = workouts.filter(w => w.workout_date === today);
    const todayBlocks = blocks.filter(b => b.block_date === today);

    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7Iso = in7.toISOString().slice(0, 10);
    const billsDueSoon = subs.filter(s => s.next_due_date && s.next_due_date >= today && s.next_due_date <= in7Iso);
    const totalDebt = debts.reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
    const choresDue = chores.filter(c => c.next_due && c.next_due <= today);

    const upcomingBH = bh.map(b => {
      const target = new Date(b.event_date + "T00:00:00");
      if (b.is_recurring_yearly) target.setFullYear(new Date().getFullYear());
      let diff = Math.ceil((target - new Date(today + "T00:00:00")) / 86400000);
      if (diff < 0 && b.is_recurring_yearly) { target.setFullYear(target.getFullYear() + 1); diff = Math.ceil((target - new Date(today + "T00:00:00")) / 86400000); }
      return { ...b, daysAway: diff };
    }).filter(b => b.daysAway >= 0 && b.daysAway <= 30).sort((a, b) => a.daysAway - b.daysAway);

    container.innerHTML = `
      <div class="grid grid-4">
        <div class="card"><div class="stat-label">Due today</div><div class="stat-value">${dueToday.length}</div><div class="stat-sub">${openTasks.length} open in total</div></div>
        <div class="card"><div class="stat-label">Overdue</div><div class="stat-value" style="color:${overdue.length ? 'var(--accent-red)' : 'inherit'}">${overdue.length}</div><div class="stat-sub">across tasks &amp; projects</div></div>
        <div class="card"><div class="stat-label">Active projects</div><div class="stat-value">${activeProjects.length}</div><div class="stat-sub">${projects.length} total</div></div>
        <div class="card"><div class="stat-label">This month</div><div class="stat-value">${fmtMoney(income - expense)}</div><div class="stat-sub">${fmtMoney(income)} in · ${fmtMoney(expense)} out</div></div>
      </div>

      <div class="section-title">Today — ${fmtDateLong(today)}</div>
      <div class="grid grid-3">
        <div class="card">
          <div class="stat-label">Main task</div>
          <div style="font-size:15px;font-weight:600;margin-top:8px">${mainTask ? mainTask.title : "Nothing critical today"}</div>
        </div>
        <div class="card">
          <div class="stat-label">Meals</div>
          <div style="font-size:13px;margin-top:8px;display:flex;flex-direction:column;gap:4px">
            <div>Breakfast: ${mealFor("breakfast")?.description || "—"}</div>
            <div>Lunch: ${mealFor("lunch")?.description || "—"}</div>
            <div>Dinner: ${mealFor("dinner")?.description || "—"}</div>
          </div>
        </div>
        <div class="card">
          <div class="stat-label">Time blocked</div>
          <div class="stat-value">${todayBlocks.length}</div>
          <div class="stat-sub">${todayWorkouts.length} workout${todayWorkouts.length === 1 ? "" : "s"} logged today</div>
        </div>
      </div>

      <div class="section-title">Finance</div>
      <div class="grid grid-2">
        <div class="card">
          <div class="grid grid-2">
            <div><div class="stat-label">Left to budget</div><div class="stat-value" style="font-size:20px">${fmtMoney(income - plannedTotal)}</div></div>
            <div><div class="stat-label">Total debt</div><div class="stat-value" style="font-size:20px">${fmtMoney(totalDebt)}</div></div>
          </div>
        </div>
        <div class="card">
          <div class="stat-label">Bills / subscriptions due in 7 days</div>
          ${billsDueSoon.length ? `<div class="list" style="margin-top:8px">${billsDueSoon.map(s => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span>${s.name}</span><span style="color:var(--text-muted)">${fmtDate(s.next_due_date)} · ${fmtMoney(s.amount)}</span></div>`).join("")}</div>` : `<div class="stat-sub" style="margin-top:8px">Nothing due soon</div>`}
        </div>
      </div>

      <div class="section-title">Organization</div>
      <div class="grid grid-2">
        <div class="card">
          <div class="stat-label" style="margin-bottom:10px">Goal progress by category</div>
          ${goalByCategory.length ? goalByCategory.map(g => `
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${g.cat}</span><span style="color:var(--text-muted)">${g.avg}%</span></div>
              <div style="height:5px;border-radius:4px;background:var(--surface-2)"><div style="height:100%;border-radius:4px;width:${g.avg}%;background:var(--accent-teal)"></div></div>
            </div>`).join("") : `<div class="empty-state">No goals yet</div>`}
        </div>
        <div class="card">
          <div class="stat-label" style="margin-bottom:10px">Active projects</div>
          ${activeProjects.length ? activeProjects.slice(0, 5).map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:13px;font-weight:500">${p.name}</span>${statusBadge(p.status)}
            </div>`).join("") : `<div class="empty-state">No projects yet</div>`}
        </div>
      </div>

      <div class="section-title">Wellness &amp; chores</div>
      <div class="grid grid-3">
        <div class="card"><div class="stat-label">Habits this week</div><div class="stat-value">${habitPct}%</div><div class="stat-sub">${habitLogsThisWeek.length} of ${habitPossible} checks</div></div>
        <div class="card"><div class="stat-label">Chores due</div><div class="stat-value">${choresDue.length}</div><div class="stat-sub">${chores.length} total tracked</div></div>
        <div class="card"><div class="stat-label">Upcoming birthdays &amp; holidays</div>
          ${upcomingBH.length ? `<div style="margin-top:6px">${upcomingBH.slice(0, 3).map(b => `<div style="font-size:12px;padding:2px 0">${b.name} <span style="color:var(--text-muted)">· ${b.daysAway === 0 ? "today" : "in " + b.daysAway + "d"}</span></div>`).join("")}</div>` : `<div class="stat-sub">None in the next 30 days</div>`}
        </div>
      </div>

      <div class="section-title">Today &amp; overdue tasks</div>
      <div class="list" id="dash-today-list"></div>
    `;

    const list = document.getElementById("dash-today-list");
    const combined = [...overdue, ...dueToday.filter(t => !overdue.includes(t))];
    if (!combined.length) {
      list.innerHTML = `<div class="empty-state">Nothing due today — nice.</div>`;
    } else {
      list.innerHTML = combined.map(t => `
        <div class="row">
          <div class="row-check ${t.status === 'completed' ? 'checked' : ''}" data-task="${t.id}">✓</div>
          <div class="row-title">${t.title}</div>
          <div class="row-meta">${t.due_date ? fmtDate(t.due_date) : ''} ${statusBadge(isOverdue(t.due_date, t.status) ? 'overdue' : t.status)}</div>
        </div>
      `).join("");
      list.querySelectorAll("[data-task]").forEach(chk => {
        chk.addEventListener("click", async () => {
          const id = chk.dataset.task;
          const checked = chk.classList.contains("checked");
          await DB.update("tasks", id, { status: checked ? "to_do" : "completed", completed_at: checked ? null : new Date().toISOString() });
          Dashboard.render();
        });
      });
    }
  }
};
