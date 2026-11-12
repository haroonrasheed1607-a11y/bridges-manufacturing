export function catalogDraft(item) {
  return { code: item.code ?? "", name: item.name ?? "", rate: item.rate ?? "", unit: item.unit ?? "Item", piecesPerUnit: item.piecesPerUnit ?? 1 };
}
function normalized(draft) {
  return { code: draft.code.trim(), name: draft.name.trim(), rate: draft.rate === "" || draft.rate == null ? null : Number(draft.rate),
    unit: draft.unit, piecesPerUnit: draft.unit === "Item" ? 1 : Number(draft.piecesPerUnit) };
}
export function catalogItemChanges(item, draft) {
  const before = normalized(catalogDraft(item)), after = normalized(draft);
  return [["code", "Item code"], ["name", "Item name"], ["rate", "Rate"], ["unit", "Unit"], ["piecesPerUnit", "Pieces per unit"]]
    .filter(([key]) => before[key] !== after[key])
    .map(([key, label]) => ({ label, before: before[key] ?? "—", after: after[key] ?? "—" }));
}
export async function saveConfirmedCatalogItem(item, draft, { confirm, save, allowDetails = false }) {
  const value = normalized(draft);
  if (!allowDetails && value.rate !== normalized(catalogDraft(item)).rate) return { error: "Only Accounts users can change item rates." };
  if (!allowDetails && (value.code !== item.code || value.name !== item.name)) return { error: "Only Accounts users can change item codes and names." };
  if (!value.code || value.code.length > 80 || !value.name || value.name.length > 180) return { error: "Enter an item code and name." };
  if (value.rate !== null && (!Number.isFinite(value.rate) || value.rate < 0 || value.rate >= 1000000000)) return { error: "Enter a valid nonnegative rate." };
  if (!["Item", "Pack", "Box"].includes(value.unit) || !Number.isInteger(value.piecesPerUnit) || value.piecesPerUnit < 1 || value.piecesPerUnit > 1000000) return { error: "Enter 1–1,000,000 pieces per pack or box." };
  const changes = catalogItemChanges(item, draft);
  if (!changes.length) return { saved: false };
  const message = "Confirm changes to " + item.name + "?\n\n" + changes.map(change => change.label + ": " + change.before + " → " + change.after).join("\n") + "\n\nThese changes apply to future orders.";
  if (!confirm(message)) return { saved: false };
  const error = await save({ p_item: item.id, p_code: value.code, p_name: value.name, p_rate: value.rate,
    p_unit: value.unit, p_pieces_per_unit: value.piecesPerUnit, p_revision: item.revision });
  return error ? { error } : { saved: true, value };
}
