import { React } from "../../vendor/react-runtime.js";

export function ClientCatalog({ clients, onRegisterItem }) {
  const [clientId, setClientId] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const client = clients.find(row => row.id === clientId) || clients[0];

  async function register(event) {
    event.preventDefault();
    if (busy || !client) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const problem = await onRegisterItem({
        p_customer: client.id, p_code: form.get("code"), p_name: form.get("name"),
        p_rate: form.get("rate") === "" ? null : Number(form.get("rate")),
      });
      if (problem) setError(problem);
      else { setAdding(false); setNotice("Item registered."); }
    } finally { setBusy(false); }
  }

  if (!client) return null;
  return <section className="panel">
    <div className="section-heading">
      <h3>Client item catalog</h3>
      <button type="button" onClick={() => {setAdding(value => !value);setError("");setNotice("");}} disabled={busy}>
        {adding ? "Cancel" : "Register item"}
      </button>
    </div>
    <label className="field">Client
      <select value={client.id} disabled={busy} onChange={e => {
        setClientId(e.target.value);setAdding(false);setError("");setNotice("");
      }}>
        {clients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    {adding && <form onSubmit={register}>
      <div className="form-grid">
        <label className="field">Item code<input name="code" required maxLength={80} /></label>
        <label className="field">Item name<input name="name" required maxLength={180} /></label>
        <label className="field">Rate (optional)<input name="rate" type="number" min="0" step="any" /></label>
      </div>
      <button className="primary" disabled={busy}>Save item</button>
    </form>}
    {error && <p className="alert" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {client.items.length > 0 ? <div className="table-wrap">
      <table><thead><tr><th>Item code</th><th>Item</th><th>Rate</th></tr></thead>
        <tbody>{client.items.map(item => <tr key={item.id}>
          <td>{item.code}</td><td>{item.name}</td><td>{item.rate ?? "—"}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p>No registered items. Add one to make it available for new orders.</p>}
  </section>;
}
