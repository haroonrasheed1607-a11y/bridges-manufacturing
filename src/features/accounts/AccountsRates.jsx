import { React } from "../../vendor/react-runtime.js";

export function AccountsRates({ api }) {
  const [clients, setClients] = React.useState([]);
  const [selected, setSelected] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const generation = React.useRef(0);
  const saving = React.useRef(false);
  const client = clients.find(row => row.id === selected) ?? clients[0];
  async function load() {
    const ticket = ++generation.current;
    setBusy(true); setError("");
    try { const rows = await api.rpc("app_accounts_item_catalog"); if (ticket === generation.current) setClients(rows); }
    catch (problem) { if (ticket === generation.current) setError(problem.message); }
    finally { if (ticket === generation.current) setBusy(false); }
  }
  React.useEffect(() => { load(); return () => { generation.current++; }; }, []);
  async function save(item, rate) {
    if (saving.current || busy) return;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate >= 1000000000)) { setError("Enter a valid nonnegative rate."); return; }
    if (!window.confirm("Change rate for " + item.name + " · " + item.code + "?\n\n" + (item.rate ?? "—") + " → " + (rate ?? "—") + "\n\nThis rate applies to future orders.")) return;
    saving.current = true; setBusy(true); setError(""); setNotice("");
    try { setClients(await api.rpc("app_accounts_save_item_rate", { p_item: item.id, p_rate: rate, p_revision: item.revision })); setNotice("Rate updated."); }
    catch (problem) { setError(problem.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="panel client-catalog">
    <div className="section-heading"><h2>Item rates</h2><button type="button" disabled={busy} onClick={load}>Refresh</button></div>
    <p className="quiet">Accounts manages rates for future orders. Existing orders keep their saved rates.</p>
    <label className="field">Client<select value={client?.id ?? ""} disabled={busy} onChange={event => { setSelected(event.target.value); setNotice(""); setError(""); }}>
      {clients.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select></label>
    {error && <p className="alert" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {busy && <p role="status">Loading / saving rates…</p>}
    {client && <div className="table-wrap"><table className="catalog-edit-table"><thead><tr><th>Code</th><th>Item</th><th>Unit</th><th>Pieces per unit</th><th>Rate</th><th>Action</th></tr></thead>
      <tbody>{client.items.map(item => <AccountRateRow key={item.id + ":" + item.revision} item={item} busy={busy} onSave={save} />)}</tbody>
    </table></div>}
  </section>;
}
export function AccountRateRow({ item, busy, onSave }) {
  const [rate, setRate] = React.useState(item.rate ?? "");
  const next = rate === "" ? null : Number(rate);
  return <tr><td>{item.code}</td><td>{item.name}</td><td>{item.unit}</td><td>{item.piecesPerUnit}</td>
    <td><input aria-label={"Rate: " + item.name} type="number" min="0" step="any" value={rate} disabled={busy} onChange={event => setRate(event.target.value)} /></td>
    <td><button type="button" disabled={busy || next === item.rate || (next === null && item.rate == null)} onClick={() => onSave(item, next)}>Save rate</button></td>
  </tr>;
}
