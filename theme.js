const Theme = {
  async init() {
    const saved = localStorage.getItem("lifehq-theme");
    const mode = saved || "dark";
    this.apply(mode);

    document.getElementById("theme-toggle").addEventListener("click", () => {
      const current = document.body.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      this.apply(next);
      localStorage.setItem("lifehq-theme", next);
      DB.updateSettings({ theme_mode: next });
    });
  },

  apply(mode) {
    document.body.setAttribute("data-theme", mode);
    document.getElementById("theme-toggle-label").textContent =
      mode === "dark" ? "Dark mode" : "Light mode";
  }
};
