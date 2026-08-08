// Small wrapper around Supabase table calls so the rest of the app
// doesn't have to repeat error handling everywhere.
const DB = {
  async list(table, { order, ascending = true, filters = {} } = {}) {
    let q = sb.from(table).select("*");
    for (const [col, val] of Object.entries(filters)) {
      if (val === null) q = q.is(col, null);
      else q = q.eq(col, val);
    }
    if (order) q = q.order(order, { ascending });
    const { data, error } = await q;
    if (error) { console.error(table, error); return []; }
    return data || [];
  },

  async insert(table, row) {
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) { console.error(table, error); alert("Couldn't save: " + error.message); return null; }
    return data;
  },

  async update(table, id, patch) {
    const { data, error } = await sb.from(table).update(patch).eq("id", id).select().single();
    if (error) { console.error(table, error); alert("Couldn't update: " + error.message); return null; }
    return data;
  },

  async remove(table, id) {
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) { console.error(table, error); alert("Couldn't delete: " + error.message); return false; }
    return true;
  },

  async getSettings() {
    const { data, error } = await sb.from("settings").select("*").eq("id", 1).single();
    if (error) { console.error(error); return { currency_symbol: "$", week_start_day: "sunday", theme_mode: "dark" }; }
    return data;
  },

  async updateSettings(patch) {
    return this.update("settings", 1, patch);
  }
};
