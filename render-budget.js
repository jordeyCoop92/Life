const BUDGET_GROUPS = {
  income: "Income",
  bill: "Bill",
  expense: "Expense",
  savings: "Savings",
  subscription: "Subscription",
  debt: "Debt"
};

const Budget = {
  tab: "overview",

  async render() {
    const container = document.getElementById("view-budget");
    const [accounts, categories, tx, subs, debts, funds, investments, netWorth, settings] = await Promise.all([
      DB.list("bank_accounts", { order: "name" }),
      DB.list("budget_categories", { order: "name" }),
      DB.list("budget_transactions", { order: "transaction_date", ascending: false }),
      DB.list("subscriptions", { order: "next_due_date" }),
      DB.list("debts", { order: "due_date" }),
      DB.list("sinking_funds", { order: "name" }),
      DB.list("investments", { order: "entry_date", ascending: false }),
      DB.list("net_worth_snapshots", { order: "snapshot_date", ascending: false }),
      DB.getSettings()
    ]);
    this.data = { accounts, categories, tx, subs, debts, funds, investments, netWorth, settings };
    this._draw(container);
  },

  _draw(container) {
    const tabs = [
      ["overview", "Overview"], ["transactions", "Transactions"],
      ["bills", "Bills & Subscriptions"], ["debts", "Debts"],
      ["savings", "Savings & Net Worth"], ["setup", "Setup"]
    ];
    container.innerHTML = `
      <div class="tabs">${tabs.map(([k, l]) => `<button class="tab-btn ${this.tab === k ? "active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
      <div id="budget-body"></div>
    `;
    container.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this.tab = b.dataset.tab; this._draw(container); }));
    const body = document.getElementById("budget-body");
    ({
      overview: () => this._overview(body),
      transactions: () => this._transactions(body),
      bills: () => this._bills(body),
      debts: () => this._debts(body),
      savings: () => this._savings(body),
      setup: () => this._setup(body)
    })[this.tab]();
  },

  // ---- carry-over math ----
  _categoryStats(cat) {
    const { tx, settings } = this.data;
    const carryOver = settings.budget_method === "carry_over" && cat.carry_over;
    const catTx = tx.filter(t => t.category_id === cat.id && t.transaction_type === "expense");
    const thisMonth = todayISO().slice(0, 7);
    const spentThisMonth = catTx.filter(t => t.transaction_date.startsWith(thisMonth)).reduce((s, t) => s + Number(t.amount), 0);

    let carried = 0;
    if (carryOver) {
      const months = [...new Set(catTx.map(t => t.transaction_date.slice(0, 7)))].filter(m => m < thisMonth);
      months.forEach(m => {
        const spent = catTx.filter(t => t.transaction_date.startsWith(m)).reduce((s, t) => s + Number(t.amount), 0);
        carried += Number(cat.planned_amount) - spent;
      });
    }
    const available = Number(cat.planned_amount) + carried - spentThisMonth;
    return { spentThisMonth, carried, available };
  },

  _overview(body) {
    const { categories, tx } = this.data;
    const thisMonth = todayISO().slice(0, 7);
    const monthTx = tx.filter(t => t.transaction_date.startsWith(thisMonth));
    const income = monthTx.filter(t => t.transaction_type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = monthTx.filter(t => t.transaction_type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const spendCats = categories.filter(c => c.group_type !== "income");
    const totalAvailable = spendCats.reduce((s, c) => s + this._categoryStats(c).available, 0);
    const totalPlanned = spendCats.reduce((s, c) => s + Number(c.planned_amount), 0);

    body.innerHTML = `
      <div class="grid grid-4">
        <div class="card"><div class="stat-label">Received</div><div class="stat-value">${fmtMoney(income)}</div></div>
        <div class="card"><div class="stat-label">Spent</div><div class="stat-value">${fmtMoney(expense)}</div></div>
        <div class="card"><div class="stat-label">Left to budget</div><div class="stat-value">${fmtMoney(income - totalPlanned)}</div></div>
        <div class="card"><div class="stat-label">Left to spend</div><div class="stat-value" style="color:${totalAvailable < 0 ? 'var(--accent-red)' : 'inherit'}">${fmtMoney(totalAvailable)}</div></div>
      </div>
      <div class="section-title">By category <span style="font-weight:400;font-size:12px;color:var(--text-muted)">carry-over method — unspent rolls forward</span></div>
      <div class="list">
        ${spendCats.length ? spendCats.map(c => {
          const s = this._categoryStats(c);
          const pct = c.planned_amount > 0 ? Math.min(100, Math.round((s.spentThisMonth / c.planned_amount) * 100)) : 0;
          return `<div class="row" style="flex-direction:column;align-items:stretch;gap:8px">
            <div style="display:flex;justify-content:space-between">
              <span class="row-title">${c.name} <span style="font-weight:400;color:var(--text-muted)">· ${BUDGET_GROUPS[c.group_type]}</span></span>
              <span style="font-size:13px;font-weight:600;color:${s.available < 0 ? 'var(--accent-red)' : 'var(--accent-teal)'}">${fmtMoney(s.available)} left</span>
            </div>
            <div style="height:6px;border-radius:4px;background:var(--surface-2)"><div style="height:100%;border-radius:4px;width:${pct}%;background:${pct >= 100 ? 'var(--accent-red)' : 'var(--accent-blue)'}"></div></div>
            <div class="row-meta" style="font-size:11px">planned ${fmtMoney(c.planned_amount)} · spent ${fmtMoney(s.spentThisMonth)} ${s.carried ? `· carried ${fmtMoney(s.carried)}` : ""}</div>
          </div>`;
        }).join("") : `<div class="empty-state">Add a budget category in Setup to get started.</div>`}
      </div>
    `;
  },

  _transactions(body) {
    const { tx, categories, accounts } = this.data;
    body.innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-primary" id="add-tx">+ New transaction</button></div>
      <div class="list">${tx.length ? tx.map(t => {
        const cat = categories.find(c => c.id === t.category_id);
        return `<div class="row" data-open="${t.id}">
          <div class="row-title" style="color:${t.transaction_type === 'income' ? 'var(--accent-teal)' : 'inherit'}">${t.transaction_type === 'income' ? '+' : '−'}${fmtMoney(t.amount)} ${t.description ? "· " + t.description : ""}</div>
          <div class="row-meta">${cat ? cat.name : "Uncategorized"} · ${fmtDate(t.transaction_date)}</div>
        </div>`;
      }).join("") : `<div class="empty-state">No transactions logged yet.</div>`}</div>
    `;
    document.getElementById("add-tx").onclick = () => this._txForm(null);
    body.querySelectorAll("[data-open]").forEach(r => r.addEventListener("click", () => this._txForm(tx.find(t => t.id === r.dataset.open))));
  },

  _txForm(t) {
    const isEdit = !!t; t = t || { transaction_type: "expense", transaction_date: todayISO() };
    const { categories, accounts } = this.data;
    openModal(`
      <h3>${isEdit ? "Edit" : "New"} transaction</h3>
      <div class="field-row">
        <div class="field"><label>Type</label><select id="f-type"><option value="expense" ${t.transaction_type === 'expense' ? 'selected' : ''}>Expense</option><option value="income" ${t.transaction_type === 'income' ? 'selected' : ''}>Income</option></select></div>
        <div class="field"><label>Amount</label><input id="f-amount" type="number" step="0.01" value="${t.amount || ""}"></div>
      </div>
      <div class="field"><label>Description</label><input id="f-desc" value="${t.description || ""}"></div>
      <div class="field-row">
        <div class="field"><label>Category</label><select id="f-cat"><option value="">— None —</option>${categories.map(c => `<option value="${c.id}" ${t.category_id === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select></div>
        <div class="field"><label>Account</label><select id="f-acc"><option value="">— None —</option>${accounts.map(a => `<option value="${a.id}" ${t.account_id === a.id ? "selected" : ""}>${a.name}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${t.transaction_date}"></div>
      <div class="modal-actions">
        ${isEdit ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : ""}
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `);
    document.getElementById("f-cancel").onclick = closeModal;
    if (isEdit) document.getElementById("f-delete").onclick = async () => { await DB.remove("budget_transactions", t.id); closeModal(); Budget.render(); };
    document.getElementById("f-save").onclick = async () => {
      const patch = {
        transaction_type: document.getElementById("f-type").value,
        amount: Number(document.getElementById("f-amount").value || 0),
        description: document.getElementById("f-desc").value,
        category_id: document.getElementById("f-cat").value || null,
        account_id: document.getElementById("f-acc").value || null,
        transaction_date: document.getElementById("f-date").value
      };
      if (!patch.amount) return alert("Enter an amount.");
      if (isEdit) await DB.update("budget_transactions", t.id, patch);
      else await DB.insert("budget_transactions", patch);
      closeModal(); Budget.render();
    };
  },

  _bills(body) {
    const { subs } = this.data;
    body.innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-primary" id="add-sub">+ New bill / subscription</button></div>
      <div class="list">${subs.length ? subs.map(s => `
        <div class="row">
          <div class="row-title">${s.name} <span style="color:var(--text-muted);font-weight:400">· ${fmtMoney(s.amount)} / ${s.billing_cycle}</span></div>
          <div class="row-meta">${s.next_due_date ? "next " + fmtDate(s.next_due_date) : ""}</div>
          <button class="btn btn-sm" data-pay="${s.id}">Log payment</button>
          <button class="btn btn-sm btn-ghost" data-edit="${s.id}">Edit</button>
        </div>`).join("") : `<div class="empty-state">No bills or subscriptions yet.</div>`}</div>
    `;
    document.getElementById("add-sub").onclick = () => this._subForm(null);
    body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => this._subForm(subs.find(s => s.id === b.dataset.edit))));
    body.querySelectorAll("[data-pay]").forEach(b => b.addEventListener("click", async () => {
      const s = subs.find(x => x.id === b.dataset.pay);
      await DB.insert("budget_transactions", { transaction_type: "expense", amount: s.amount, description: s.name, transaction_date: todayISO() });
      const next = new Date(s.next_due_date || todayISO());
      if (s.billing_cycle === "monthly") next.setMonth(next.getMonth() + 1);
      else if (s.billing_cycle === "yearly") next.setFullYear(next.getFullYear() + 1);
      else next.setDate(next.getDate() + 7);
      await DB.update("subscriptions", s.id, { next_due_date: next.toISOString().slice(0, 10) });
      Budget.render();
    }));
  },

  _subForm(s) {
    const isEdit = !!s; s = s || { billing_cycle: "monthly" };
    openModal(`
      <h3>${isEdit ? "Edit" : "New"} bill / subscription</h3>
      <div class="field"><label>Name</label><input id="f-name" value="${s.name || ""}"></div>
      <div class="field-row">
        <div class="field"><label>Amount</label><input id="f-amount" type="number" step="0.01" value="${s.amount || ""}"></div>
        <div class="field"><label>Billing cycle</label><select id="f-cycle"><option value="weekly" ${s.billing_cycle==='weekly'?'selected':''}>Weekly</option><option value="monthly" ${s.billing_cycle==='monthly'?'selected':''}>Monthly</option><option value="yearly" ${s.billing_cycle==='yearly'?'selected':''}>Yearly</option></select></div>
      </div>
      <div class="field"><label>Next due date</label><input id="f-due" type="date" value="${s.next_due_date || ""}"></div>
      <div class="modal-actions">
        ${isEdit ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : ""}
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `);
    document.getElementById("f-cancel").onclick = closeModal;
    if (isEdit) document.getElementById("f-delete").onclick = async () => { await DB.remove("subscriptions", s.id); closeModal(); Budget.render(); };
    document.getElementById("f-save").onclick = async () => {
      const patch = { name: document.getElementById("f-name").value.trim(), amount: Number(document.getElementById("f-amount").value || 0), billing_cycle: document.getElementById("f-cycle").value, next_due_date: document.getElementById("f-due").value || null };
      if (!patch.name) return alert("Give it a name.");
      if (isEdit) await DB.update("subscriptions", s.id, patch); else await DB.insert("subscriptions", patch);
      closeModal(); Budget.render();
    };
  },

  _debts(body) {
    const { debts } = this.data;
    body.innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-primary" id="add-debt">+ New debt</button></div>
      <div class="list">${debts.length ? debts.map(d => {
        const pct = d.total_amount > 0 ? Math.round(((d.total_amount - d.remaining_amount) / d.total_amount) * 100) : 0;
        return `<div class="row" style="flex-direction:column;align-items:stretch;gap:8px">
          <div style="display:flex;justify-content:space-between"><span class="row-title">${d.name}</span><span style="font-size:12px;color:var(--text-muted)">${fmtMoney(d.remaining_amount)} left of ${fmtMoney(d.total_amount)}</span></div>
          <div style="height:6px;border-radius:4px;background:var(--surface-2)"><div style="height:100%;border-radius:4px;width:${pct}%;background:var(--accent-teal)"></div></div>
          <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn btn-sm" data-pay="${d.id}">Log payment</button><button class="btn btn-sm btn-ghost" data-edit="${d.id}">Edit</button></div>
        </div>`;
      }).join("") : `<div class="empty-state">No debts tracked. Nice, or add one to track payoff.</div>`}</div>
    `;
    document.getElementById("add-debt").onclick = () => this._debtForm(null);
    body.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => this._debtForm(debts.find(d => d.id === b.dataset.edit))));
    body.querySelectorAll("[data-pay]").forEach(b => b.addEventListener("click", async () => {
      const d = debts.find(x => x.id === b.dataset.pay);
      const amt = Number(prompt(`Payment amount toward "${d.name}"?`, d.minimum_payment || ""));
      if (!amt) return;
      await DB.update("debts", d.id, { remaining_amount: Math.max(0, Number(d.remaining_amount) - amt) });
      await DB.insert("budget_transactions", { transaction_type: "expense", amount: amt, description: "Debt payment — " + d.name, transaction_date: todayISO() });
      Budget.render();
    }));
  },

  _debtForm(d) {
    const isEdit = !!d; d = d || {};
    openModal(`
      <h3>${isEdit ? "Edit" : "New"} debt</h3>
      <div class="field"><label>Name</label><input id="f-name" value="${d.name || ""}"></div>
      <div class="field-row">
        <div class="field"><label>Total amount</label><input id="f-total" type="number" step="0.01" value="${d.total_amount || ""}"></div>
        <div class="field"><label>Remaining</label><input id="f-remaining" type="number" step="0.01" value="${d.remaining_amount ?? d.total_amount ?? ""}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Interest rate %</label><input id="f-rate" type="number" step="0.01" value="${d.interest_rate || ""}"></div>
        <div class="field"><label>Min payment</label><input id="f-min" type="number" step="0.01" value="${d.minimum_payment || ""}"></div>
      </div>
      <div class="field"><label>Due date</label><input id="f-due" type="date" value="${d.due_date || ""}"></div>
      <div class="modal-actions">
        ${isEdit ? `<button class="btn btn-danger" id="f-delete">Delete</button>` : ""}
        <button class="btn" id="f-cancel">Cancel</button>
        <button class="btn btn-primary" id="f-save">Save</button>
      </div>
    `);
    document.getElementById("f-cancel").onclick = closeModal;
    if (isEdit) document.getElementById("f-delete").onclick = async () => { await DB.remove("debts", d.id); closeModal(); Budget.render(); };
    document.getElementById("f-save").onclick = async () => {
      const patch = {
        name: document.getElementById("f-name").value.trim(),
        total_amount: Number(document.getElementById("f-total").value || 0),
        remaining_amount: Number(document.getElementById("f-remaining").value || 0),
        interest_rate: Number(document.getElementById("f-rate").value || 0),
        minimum_payment: Number(document.getElementById("f-min").value || 0),
        due_date: document.getElementById("f-due").value || null
      };
      if (!patch.name) return alert("Give it a name.");
      if (isEdit) await DB.update("debts", d.id, patch); else await DB.insert("debts", patch);
      closeModal(); Budget.render();
    };
  },

  _savings(body) {
    const { funds, investments, netWorth } = this.data;
    const lastNW = netWorth[0];
    body.innerHTML = `
      <div class="grid grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Sinking funds <button class="btn btn-sm" id="add-fund">+ Add</button></div>
          <div class="list">${funds.length ? funds.map(f => {
            const pct = f.target_amount > 0 ? Math.min(100, Math.round((f.current_amount / f.target_amount) * 100)) : 0;
            return `<div class="row" style="flex-direction:column;align-items:stretch;gap:8px">
              <div style="display:flex;justify-content:space-between"><span class="row-title">${f.name}</span><span style="font-size:12px;color:var(--text-muted)">${fmtMoney(f.current_amount)} / ${fmtMoney(f.target_amount)}</span></div>
              <div style="height:6px;border-radius:4px;background:var(--surface-2)"><div style="height:100%;border-radius:4px;width:${pct}%;background:var(--accent-purple)"></div></div>
              <div style="display:flex;justify-content:flex-end"><button class="btn btn-sm" data-contrib="${f.id}">Add contribution</button></div>
            </div>`;
          }).join("") : `<div class="empty-state">No sinking funds yet.</div>`}</div>
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Net worth <button class="btn btn-sm" id="add-nw">+ Snapshot</button></div>
          <div class="card">
            ${lastNW ? `<div class="stat-label">As of ${fmtDate(lastNW.snapshot_date)}</div><div class="stat-value">${fmtMoney(lastNW.total_assets - lastNW.total_liabilities)}</div><div class="stat-sub">${fmtMoney(lastNW.total_assets)} assets − ${fmtMoney(lastNW.total_liabilities)} liabilities</div>` : `<div class="empty-state">No snapshot yet.</div>`}
          </div>
          <div class="section-title">Investments <button class="btn btn-sm" id="add-inv">+ Add</button></div>
          <div class="list">${investments.length ? investments.map(i => `<div class="row"><div class="row-title">${i.name}</div><div class="row-meta">${i.investment_type || ""} · ${fmtMoney(i.amount)}</div></div>`).join("") : `<div class="empty-state">No investments logged.</div>`}</div>
        </div>
      </div>
    `;
    document.getElementById("add-fund").onclick = () => this._fundForm();
    document.getElementById("add-nw").onclick = () => this._nwForm();
    document.getElementById("add-inv").onclick = () => this._invForm();
    body.querySelectorAll("[data-contrib]").forEach(b => b.addEventListener("click", async () => {
      const f = funds.find(x => x.id === b.dataset.contrib);
      const amt = Number(prompt(`Add how much to "${f.name}"?`));
      if (!amt) return;
      await DB.update("sinking_funds", f.id, { current_amount: Number(f.current_amount) + amt });
      Budget.render();
    }));
  },

  _fundForm() {
    openModal(`<h3>New sinking fund</h3>
      <div class="field"><label>Name</label><input id="f-name" placeholder="e.g. Christmas"></div>
      <div class="field-row"><div class="field"><label>Target</label><input id="f-target" type="number" step="0.01"></div><div class="field"><label>Current</label><input id="f-current" type="number" step="0.01" value="0"></div></div>
      <div class="field"><label>Target date</label><input id="f-date" type="date"></div>
      <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-save").onclick = async () => {
      const name = document.getElementById("f-name").value.trim();
      if (!name) return alert("Name it.");
      await DB.insert("sinking_funds", { name, target_amount: Number(document.getElementById("f-target").value || 0), current_amount: Number(document.getElementById("f-current").value || 0), target_date: document.getElementById("f-date").value || null });
      closeModal(); Budget.render();
    };
  },

  _invForm() {
    openModal(`<h3>New investment</h3>
      <div class="field"><label>Name</label><input id="f-name"></div>
      <div class="field-row"><div class="field"><label>Type</label><input id="f-type" placeholder="e.g. ETF"></div><div class="field"><label>Amount</label><input id="f-amount" type="number" step="0.01"></div></div>
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
      <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-save").onclick = async () => {
      const name = document.getElementById("f-name").value.trim();
      if (!name) return alert("Name it.");
      await DB.insert("investments", { name, investment_type: document.getElementById("f-type").value, amount: Number(document.getElementById("f-amount").value || 0), entry_date: document.getElementById("f-date").value });
      closeModal(); Budget.render();
    };
  },

  _nwForm() {
    openModal(`<h3>Net worth snapshot</h3>
      <div class="field-row"><div class="field"><label>Total assets</label><input id="f-assets" type="number" step="0.01"></div><div class="field"><label>Total liabilities</label><input id="f-liab" type="number" step="0.01"></div></div>
      <div class="field"><label>Date</label><input id="f-date" type="date" value="${todayISO()}"></div>
      <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
    document.getElementById("f-cancel").onclick = closeModal;
    document.getElementById("f-save").onclick = async () => {
      await DB.insert("net_worth_snapshots", { total_assets: Number(document.getElementById("f-assets").value || 0), total_liabilities: Number(document.getElementById("f-liab").value || 0), snapshot_date: document.getElementById("f-date").value });
      closeModal(); Budget.render();
    };
  },

  _setup(body) {
    const { accounts, categories } = this.data;
    body.innerHTML = `
      <div class="grid grid-2">
        <div>
          <div class="section-title" style="margin-top:0">Bank accounts <button class="btn btn-sm" id="add-acc">+ Add</button></div>
          <div class="list">${accounts.length ? accounts.map(a => `<div class="row"><div class="row-title">${a.name}</div><div class="row-meta">${a.account_type || ""} · starting ${fmtMoney(a.starting_balance)}</div></div>`).join("") : `<div class="empty-state">No accounts yet.</div>`}</div>
        </div>
        <div>
          <div class="section-title" style="margin-top:0">Budget categories <button class="btn btn-sm" id="add-cat">+ Add</button></div>
          <div class="list">${categories.length ? categories.map(c => `<div class="row"><div class="row-title">${c.name}</div><div class="row-meta">${BUDGET_GROUPS[c.group_type]} · ${fmtMoney(c.planned_amount)}/mo ${c.carry_over ? "· carries over" : ""}</div></div>`).join("") : `<div class="empty-state">No categories yet.</div>`}</div>
        </div>
      </div>
    `;
    document.getElementById("add-acc").onclick = () => {
      openModal(`<h3>New bank account</h3>
        <div class="field"><label>Name</label><input id="f-name"></div>
        <div class="field-row"><div class="field"><label>Type</label><input id="f-type" placeholder="Checking, savings..."></div><div class="field"><label>Starting balance</label><input id="f-bal" type="number" step="0.01" value="0"></div></div>
        <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
      document.getElementById("f-cancel").onclick = closeModal;
      document.getElementById("f-save").onclick = async () => {
        const name = document.getElementById("f-name").value.trim();
        if (!name) return alert("Name it.");
        await DB.insert("bank_accounts", { name, account_type: document.getElementById("f-type").value, starting_balance: Number(document.getElementById("f-bal").value || 0) });
        closeModal(); Budget.render();
      };
    };
    document.getElementById("add-cat").onclick = () => {
      openModal(`<h3>New budget category</h3>
        <div class="field"><label>Name</label><input id="f-name" placeholder="e.g. Groceries"></div>
        <div class="field-row">
          <div class="field"><label>Type</label><select id="f-group">${Object.entries(BUDGET_GROUPS).map(([k,v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
          <div class="field"><label>Planned / month</label><input id="f-planned" type="number" step="0.01" value="0"></div>
        </div>
        <div class="field"><label><input type="checkbox" id="f-carry" checked> Unspent carries over to next month</label></div>
        <div class="modal-actions"><button class="btn" id="f-cancel">Cancel</button><button class="btn btn-primary" id="f-save">Save</button></div>`);
      document.getElementById("f-cancel").onclick = closeModal;
      document.getElementById("f-save").onclick = async () => {
        const name = document.getElementById("f-name").value.trim();
        if (!name) return alert("Name it.");
        await DB.insert("budget_categories", { name, group_type: document.getElementById("f-group").value, planned_amount: Number(document.getElementById("f-planned").value || 0), carry_over: document.getElementById("f-carry").checked });
        closeModal(); Budget.render();
      };
    };
  }
};
