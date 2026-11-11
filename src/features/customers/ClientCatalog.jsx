import { React } from "../../vendor/react-runtime.js";
import { ClientItemForm } from "./ClientItemForm.jsx";

export function ClientCatalog({ clients, onSaveItem }) {
  const [clientId, setClientId] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  const client = clients.find(row => row.id === clientId) || clients[0];

  function edit(item) { setEditing(item); setError(""); setNotice(""); }
  async function save(fields) {
    if (lock.current || !client) return;
    lock.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const problem = await onSaveItem({ ...fields, p_customer: client.id });
      if (problem) setError(problem);
      else { setEditing(null); setNotice(fields.p_revision ? "Item updated." : "Item registered."); }
    } catch (problem) { setError(problem.message); }
    finally { lock.current = false; setBusy(false); }
  }

  if (!client) return null;
  return <section className="panel">
    <div className="section-heading">
      <h3>Client item catalog</h3>
      <button type="button" onClick={() => edit({ id: crypto.randomUUID(), revision: 0, unit: "Item", piecesPerUnit: 1 })} disabled={busy}>Register item</button>
    </div>
    <label className="field">Client
      <select value={client.id} disabled={busy} onChange={event => { setClientId(event.target.value); edit(null); }}>
        {clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    {editing && <ClientItemForm key={editing.id} item={editing} busy={busy} onSave={save} onCancel={() => edit(null)} />}
    {error && <p className="alert" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {client.items.length > 0 ? <div className="table-wrap">
      <table><thead><tr><th>Item code</th><th>Item</th><th>Rate</th><th>Unit</th><th>Pieces per unit</th><th>Actions</th></tr></thead>
        <tbody>{client.items.map(item => <tr key={item.id}>
          <td>{item.code}</td><td>{item.name}</td><td>{item.rate ?? "—"}</td><td>{item.unit ?? "Item"}</td><td>{item.piecesPerUnit ?? 1}</td>
          <td><button type="button" aria-label={"Edit " + item.name} disabled={busy} onClick={() => edit(item)}>Edit</button></td>
        </tr>)}</tbody>
      </table>
    </div> : <p>No registered items. Add one to make it available for new orders.</p>}
  </section>;
}
