// Renders a <select> populated from a pick_lists list_type, with a
// trailing "+ Add new…" option that inserts a fresh entry on the fly.
function categorySelectHtml(fieldId, list, selectedValue, placeholder = "— None —") {
  return `<select id="${fieldId}">
    <option value="">${placeholder}</option>
    ${list.map(o => `<option value="${o.label}" ${selectedValue === o.label ? "selected" : ""}>${o.label}</option>`).join("")}
    <option value="__add_new__">+ Add new…</option>
  </select>`;
}

function bindCategorySelect(fieldId, listType) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.addEventListener("change", async (e) => {
    if (e.target.value !== "__add_new__") return;
    const label = prompt("New " + listType.replace(/_/g, " ") + ":");
    if (label && label.trim()) {
      const row = await DB.insert("pick_lists", { list_type: listType, label: label.trim() });
      if (row) {
        const opt = document.createElement("option");
        opt.value = row.label; opt.textContent = row.label;
        el.insertBefore(opt, el.lastElementChild);
        el.value = row.label;
        return;
      }
    }
    el.selectedIndex = 0;
  });
}

async function getPickList(listType) {
  const rows = await DB.list("pick_lists", { filters: { list_type: listType }, order: "sort_order" });
  return rows;
}
