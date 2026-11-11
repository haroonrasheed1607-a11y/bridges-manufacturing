import { React } from "../../vendor/react-runtime.js";

export function ClientItemForm({ item, onSave, onCancel, busy }) {
  const [unit, setUnit] = React.useState(item.unit ?? "Item");
  const [count, setCount] = React.useState(item.piecesPerUnit ?? 1);
  return <form onSubmit={event => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    onSave({
      p_item: item.id, p_code: fields.get("code"), p_name: fields.get("name"),
      p_rate: fields.get("rate") === "" ? null : Number(fields.get("rate")),
      p_unit: unit, p_pieces_per_unit: unit === "Item" ? 1 : Number(count), p_revision: item.revision ?? 0,
    });
  }}>
    <h4>{item.revision ? "Edit item" : "Register item"}</h4>
    <fieldset disabled={busy} className="catalog-item-fields">
      <div className="form-grid">
        <label className="field">Item code<input name="code" required maxLength={80} defaultValue={item.code ?? ""} /></label>
        <label className="field">Item name<input name="name" required maxLength={180} defaultValue={item.name ?? ""} /></label>
        <label className="field">Rate (optional)<input name="rate" type="number" min="0" step="any" defaultValue={item.rate ?? ""} /></label>
        <label className="field">Unit<select value={unit} onChange={event => setUnit(event.target.value)}>
          <option>Item</option><option>Pack</option><option>Box</option>
        </select></label>
        {unit !== "Item" && <label className="field">Pieces per {unit.toLowerCase()}
          <input type="number" min="1" max="1000000" step="1" required value={count} onChange={event => setCount(event.target.value)} />
        </label>}
      </div>
      <p className="quiet">{unit === "Item" ? "One item = one piece." : "Enter the number of individual pieces in one " + unit.toLowerCase() + "."} Used when planning new work.</p>
      <div className="form-actions"><button type="button" onClick={onCancel}>Cancel</button>
        <button className="primary">{busy ? "Saving…" : item.revision ? "Save changes" : "Save item"}</button></div>
    </fieldset>
  </form>;
}
