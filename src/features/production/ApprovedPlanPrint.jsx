import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingPrintBoxBatch } from "../../domain/boxLabels.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { dayPlanLabelIds, groupDayPlans } from "../plan/dayPlan.js";

export function ApprovedPlanPrint() {
  const { orders, orderDisplayTitle } = useManufacturing();
  const [date, setDate] = React.useState(manufacturingToday);
  const [jobId, setJobId] = React.useState("");
  const [labels, setLabels] = React.useState([]);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const request = React.useRef(0);
  const plans = groupDayPlans(labels);
  const selected = plans.find(plan => plan.jobId === jobId);

  function title(plan) {
    return orderDisplayTitle(orders.find(order => order.id === plan.orderId) ?? { title: plan.orderTitle });
  }

  async function load(planToPrint, background = false) {
    const ticket = ++request.current;
    if (!background) {
      setBusy(true);
      setError("");
      setNotice("");
    }
    try {
      const rows = await manufacturingApi.rpc("app_approved_day_plans", { p_date: date });
      if (ticket !== request.current) return;
      setLabels(rows);
      setJobId(current => rows.some(label => label.jobId === current) ? current : "");
      if (!planToPrint) return;
      const updated = groupDayPlans(rows).find(plan => plan.jobId === planToPrint.jobId);
      if (!updated || JSON.stringify(dayPlanLabelIds(updated)) !== JSON.stringify(dayPlanLabelIds(planToPrint))) {
        setError("This plan changed. Review the updated list before printing.");
        return;
      }
      const problem = manufacturingPrintBoxBatch(updated.labels.map(label => ({
        order: { id: label.orderId, title: label.orderTitle },
        work: { id: label.workId },
        job: { name: label.workDate.slice(5) + " · " + (label.jobName || "Sub-job") },
        box: { id: label.id, quantity: label.batchQuantity },
        person: { name: label.personName },
      })));
      if (problem) setError(problem);
      else setNotice("Sent " + updated.labels.length + " labels to the printer.");
    } catch (e) {
      if (!background && ticket === request.current) setError(e.message);
    } finally {
      if (!background && ticket === request.current) setBusy(false);
    }
  }

  React.useEffect(() => {
    load();
    return () => { request.current++; };
  }, [date]);

  React.useEffect(() => {
    if (busy) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(undefined, true);
    }, 15000);
    return () => clearInterval(timer);
  }, [date, busy]);

  return <section className="panel desktop-plan-print" aria-labelledby="desktop-plan-print-heading">
    <div className="section-heading">
      <h2 id="desktop-plan-print-heading">Approved plans</h2>
      <button type="button" disabled={busy} onClick={() => load()}>Refresh</button>
    </div>
    <div className="plan-toolbar">
      <label className="field">Work date
        <input type="date" min={manufacturingToday()} value={date} disabled={busy} onChange={event => {
          if (!event.target.value) return;
          setLabels([]);
          setJobId("");
          setBusy(true);
          setDate(event.target.value);
        }} />
      </label>
      <label className="field">Plan
        <select value={jobId} disabled={busy || !plans.length} onChange={event => {
          setJobId(event.target.value);
          setNotice("");
        }}>
          <option value="">{plans.length ? "Select an approved plan" : "No approved plans"}</option>
          {plans.map(plan => <option key={plan.jobId} value={plan.jobId}>
            {title(plan)} · {plan.jobName || plan.jobId} · {plan.labels.length} labels
          </option>)}
        </select>
      </label>
    </div>
    {selected && <p className="quiet">{formatDate(date)} · {selected.labels.map(label => label.personName).join(", ")}</p>}
    {busy && <p role="status">Checking approved plans…</p>}
    {error && <p role="alert" className="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <button className="primary" type="button" disabled={busy || !selected} onClick={() => load(selected)}>Print</button>
  </section>;
}
