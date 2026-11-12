import { React } from "../../vendor/react-runtime.js";
import { catalogDraft, catalogItemChanges, saveConfirmedCatalogItem } from "./catalogEditing.js";

export function ClientItemRow({ item, busy, onSave }) {
  const [base, setBase] = React.useState(item);
  const [draft, setDraft] = React.useState(() => catalogDraft(item));
  const [error, setError] = React.useState("");
  const lock = React.useRef(false);
  const dirty = catalogItemChanges(base, draft).length > 0;
  React.useEffect(() => { if (!dirty) { setBase(item); setDraft(catalogDraft(item)); } }, [item, dirty]);
  function change(key, value) { setDraft(current => ({ ...current, [key]: value })); setError(""); }
  async function save() {
    if (lock.current || busy || !dirty) return;
    lock.current = true; setError("");
    try {
      const result = await saveConfirmedCatalogItem(base, draft, { confirm: message => window.confirm(message), save: onSave });
      if (result.error) setError(result.error);
      else if (result.saved) { const updated = { ...base, ...result.value, revision: base.revision + 1 }; setBase(updated); setDraft(catalogDraft(updated)); }
    } catch (problem) { setError(problem.message); }
    finally { lock.current = false; }
  }
  return <tr className={dirty ? "catalog-item-dirty" : ""}>
    <td><input aria-label={"Item code: " + item.name} value={draft.code} required maxLength={80} disabled={busy} onChange={event => change("code", event.target.value)} /></td>
    <td><input aria-label={"Item name: " + item.name} value={draft.name} required maxLength={180} disabled={busy} onChange={event => change("name", event.target.value)} /></td>
    <td><input aria-label={"Rate: " + item.name} type="number" min="0" step="any" value={draft.rate} disabled={busy} onChange={event => change("rate", event.target.value)} /></td>
    <td><select aria-label={"Unit: " + item.name} value={draft.unit} disabled={busy} onChange={event => change("unit", event.target.value)}>
      <option>Item</option><option>Pack</option><option>Box</option></select></td>
    <td><input aria-label={"Pieces per unit: " + item.name} type="number" min="1" max="1000000" step="1" value={draft.unit === "Item" ? 1 : draft.piecesPerUnit}
      disabled={busy || draft.unit === "Item"} onChange={event => change("piecesPerUnit", event.target.value)} /></td>
    <td><div className="form-actions"><button type="button" disabled={busy || !dirty} onClick={save} aria-label={"Save changes: " + item.name}>Save</button>
      {dirty && <button type="button" disabled={busy} onClick={() => { setBase(item); setDraft(catalogDraft(item)); setError(""); }}>Cancel</button>}</div>
      {error && <p className="alert" role="alert">{error}</p>}</td>
  </tr>;
}
