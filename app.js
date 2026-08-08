const VIEW_TITLES = {
  dashboard: "Dashboard",
  calendar: "Calendar",
  tasks: "Tasks",
  projects: "Projects",
  budget: "Budget",
  goals: "Goals",
  wellness: "Wellness",
  chores: "Chores",
  setup: "Setup"
};

const App = {
  currentView: "dashboard",

  async init() {
    await Theme.init();
    const settings = await DB.getSettings();
    CURRENCY = settings.currency_symbol || "$";
    if (settings.theme_mode) Theme.apply(settings.theme_mode);

    document.querySelectorAll(".nav-item").forEach(btn => {
      btn.addEventListener("click", () => this.switchView(btn.dataset.view));
    });

    this.switchView("dashboard");
  },

  switchView(view, titleOverride = null) {
    this.currentView = view;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    document.getElementById("view-title").textContent = titleOverride || VIEW_TITLES[view];
    this._renderTopbarActions(view);
    this._renderView(view);
  },

  _renderTopbarActions(view) {
    const actions = document.getElementById("topbar-actions");
    actions.innerHTML = "";
    if (view === "tasks") {
      actions.innerHTML = `<button class="btn btn-primary" id="add-task">+ New task</button>`;
      document.getElementById("add-task").onclick = () => Tasks._openForm(null);
    } else if (view === "projects") {
      actions.innerHTML = `<button class="btn btn-primary" id="add-project">+ New project</button>`;
      document.getElementById("add-project").onclick = () => Projects.openNew();
    } else if (view === "goals") {
      actions.innerHTML = `<button class="btn btn-primary" id="add-goal">+ New goal</button>`;
      document.getElementById("add-goal").onclick = () => Goals._form(null);
    } else if (view === "chores") {
      actions.innerHTML = `<button class="btn btn-primary" id="add-chore">+ New chore</button>`;
      document.getElementById("add-chore").onclick = () => Chores._form(null);
    }
  },

  _renderView(view) {
    if (view === "dashboard") Dashboard.render();
    else if (view === "calendar") Calendar.render();
    else if (view === "tasks") Tasks.render(null);
    else if (view === "projects") Projects.render();
    else if (view === "budget") Budget.render();
    else if (view === "goals") Goals.render();
    else if (view === "wellness") Wellness.render();
    else if (view === "chores") Chores.render();
    else if (view === "setup") Setup.render();
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
