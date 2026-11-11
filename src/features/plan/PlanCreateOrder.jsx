import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingToday } from "../../utils/dates.js";

function readPending(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value?.request && value.customer && value.item && value.date && Number.isInteger(value.quantity)) return value;
  } catch {}
  return null;
}

export function PlanCreateOrder({ onPlanned }) {
  const { profile, customerCatalog = [], refresh, open } = useManufacturing();
  const storageKey = "bridges-plan-create-order-v1:" + profile?.id;
  const [pending, setPending] = React.useState(() => readPending(storageKey));
  const [customer, setCustomer] = React.useState(pending?.customer ?? "");
  const [itemId, setItemId] = React.useState(pending?.item ?? "");
  const [quantity, setQuantity] = React.useState(pending?.quantity ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const lock = React.useRef(false);
  const client = customerCatalog.find(row => row.id === customer);
  const item = client?.items.find(row => row.id === itemId);
  const pieces = Number(quantity);
  const today = manufacturingToday();
  const disabled = busy || Boolean(pending) || Boolean(result);
  const perPack = item?.productionDefaults?.perPack ?? 25;

  async function plan(event) {
    event.preventDefault();
    if (lock.current || result || (!pending && (!item || !Number.isInteger(pieces) || pieces < 1 || pieces > 1000000))) return;
    const submission = pending ?? { request: crypto.randomUUID(), customer, item: itemId, quantity: pieces, date: manufacturingToday() };
    lock.current = true;
    setBusy(true);
    setError("");
    setPending(submission);
    try { sessionStorage.setItem(storageKey, JSON.stringify(submission)); } catch {}
    try {
      const receipt = await manufacturingApi.rpc("app_plan_create_order", {
        p_customer: submission.customer, p_item: submission.item, p_quantity: submission.quantity,
        p_date: submission.date, p_request: submission.request,
      });
      setResult(receipt);
      setPending(null);
      try { sessionStorage.removeItem(storageKey); } catch {}
      try { await refresh(); await onPlanned?.(receipt); }
      catch { setError("Work was planned successfully. Refresh Plan to load the new job."); }
    } catch (problem) {
      setError(problem.message);
      if (problem.status >= 400 && problem.status < 500) {
        setPending(null);
        try { sessionStorage.removeItem(storageKey); } catch {}
      }
    } finally { lock.current = false; setBusy(false); }
  }

  if (!["admin", "manager"].includes(profile?.role)) return null;
  return <section className="panel plan-create-order" aria-labelledby="plan-create-order-title">
    <div className="section-heading"><h3 id="plan-create-order-title">Create Order</h3>
      <small className="quiet">Production & delivery: {formatDate(today)}</small></div>
    <form onSubmit={plan}>
      <div className="plan-create-fields">
        <label className="field">Client<select required value={customer} disabled={disabled} onChange={event => {
          setCustomer(event.target.value); setItemId(""); setError("");
        }}><option value="">Select a client</option>{customerCatalog.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="field">Item<select required value={itemId} disabled={disabled || !client} onChange={event => {
          setItemId(event.target.value); setError("");
        }}><option value="">Select an item</option>{client?.items.map(row => <option key={row.id} value={row.id}>{row.name} · {row.code}</option>)}</select></label>
        <label className="field">Number of pieces<input type="number" required min="1" max="1000000" step="1" value={quantity}
          disabled={disabled} onChange={event => setQuantity(event.target.value)} /></label>
      </div>
      <div className="plan-create-footer">
        <p className="quiet">{item ? Math.min(perPack, pieces > 0 ? pieces : perPack).toLocaleString() + " pieces/scan · " : ""}
          One sub-job · All active Job Coaches · Scan & Assign ready</p>
        {!result && <button className="primary" disabled={busy || (!pending && (!item || quantity === "" || !Number.isInteger(pieces) || pieces < 1 || pieces > 1000000))}>
          {busy ? "Planning work…" : pending ? "Retry Plan Work" : "Plan Work"}
        </button>}
      </div>
    </form>
    {error && <p className="alert" role="alert">{error}</p>}
    {result && <div className="plan-created-result" role="status">
      <div><strong>{result.title} · {result.code}</strong><p>{result.quantity.toLocaleString()} pieces · Ready for production · Due {formatDate(result.required)}</p></div>
      <div className="form-actions"><button type="button" disabled={busy} onClick={() => open(result.orderId)}>View order</button>
        <button type="button" disabled={busy} onClick={() => { setResult(null); setQuantity(""); setError(""); }}>Create another</button></div>
    </div>}
  </section>;
}
