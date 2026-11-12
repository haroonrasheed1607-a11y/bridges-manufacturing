import { React } from "../../vendor/react-runtime.js";
import { ClientCatalog } from "../customers/ClientCatalog.jsx";

export function AccountsRates({ api }) {
  const [clients, setClients] = React.useState([]);
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const generation = React.useRef(0);
  const saving = React.useRef(false);
  async function load() {
    const ticket = ++generation.current;
    setBusy(true); setError("");
    try { const rows = await api.rpc("app_accounts_item_catalog"); if (ticket === generation.current) setClients(rows); }
    catch (problem) { if (ticket === generation.current) setError(problem.message); }
    finally { if (ticket === generation.current) setBusy(false); }
  }
  React.useEffect(() => { load(); return () => { generation.current++; }; }, []);
  async function saveItem(fields) {
    if (saving.current || busy) return "Another catalog change is being saved.";
    saving.current = true; setBusy(true);
    try { setClients(await api.rpc("app_save_customer_item", fields)); return ""; }
    catch (problem) { return problem.message; }
    finally { saving.current = false; setBusy(false); }
  }
  async function addClient(event) {
    event.preventDefault();
    if (saving.current || busy) return;
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (!window.confirm("Register client “" + name + "”?")) return;
    saving.current = true; setBusy(true); setError("");
    try { setClients(await api.rpc("app_save_customer", { p_name: name })); setAdding(false); }
    catch (problem) { setError(problem.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <>
    <div className="section-heading"><h2>Clients &amp; items</h2><div className="form-actions">
      <button type="button" disabled={busy} onClick={() => setAdding(value => !value)}>Register client</button>
      <button type="button" disabled={busy} onClick={load}>Refresh</button></div></div>
    {adding && <form className="panel" onSubmit={addClient}><label className="field">Client name<input name="name" required maxLength={200} disabled={busy} /></label>
      <button className="primary" disabled={busy}>Save client</button></form>}
    {error && <p className="alert" role="alert">{error}</p>}{busy && <p role="status">Loading / saving catalog…</p>}
    <p className="quiet">Changes apply to future orders. Existing orders keep their saved details.</p>
    <ClientCatalog clients={clients} onSaveItem={saveItem} accounts />
  </>;
}
