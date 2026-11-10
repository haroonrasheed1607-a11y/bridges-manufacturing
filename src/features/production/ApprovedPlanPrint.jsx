import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingPrintBoxBatch } from "../../domain/boxLabels.js";
import { hasDesktopPrinter } from "../../services/printing/desktopPrinter.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { dayPlanKey, dayPlanLabelIds, dayPlanName, groupDayPlans } from "../plan/dayPlan.js";

export function ApprovedPlanPrint() {
  const { orders, orderDisplayTitle } = useManufacturing();
  const [date, setDate] = React.useState(manufacturingToday);
  const [planKey, setPlanKey] = React.useState("");
  const [labels, setLabels] = React.useState([]);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const request = React.useRef(0);
  const plans = groupDayPlans(labels);
  const selected = plans.find(plan => plan.key === planKey);

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
      setPlanKey(current => rows.some(label => dayPlanKey(label) === current) ? current : "");
      if (!planToPrint) return;
      const updated = groupDayPlans(rows).find(plan => plan.key === planToPrint.key);
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
      else setNotice(hasDesktopPrinter()
        ? "Sent " + updated.labels.length + " labels to the printer."
        : "Confirm the label printout in your browser’s print dialog.");
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

  return <section className="panel approved-plan-print" aria-labelledby="approved-plan-print-heading">
    <div className="section-heading">
      <h2 id="approved-plan-print-heading">Approved plans</h2>
      <button type="button" disabled={busy} onClick={() => load()}>Refresh</button>
    </div>
    <div className="plan-toolbar">
      <label className="field">Work date
        <input type="date" min={manufacturingToday()} value={date} disabled={busy} onChange={event => {
          if (!event.target.value) return;
          setLabels([]);
          setPlanKey("");
          setBusy(true);
          setDate(event.target.value);
        }} />
      </label>
      <label className="field">Plan
        <select value={planKey} disabled={busy || !plans.length} onChange={event => {
          setPlanKey(event.target.value);
          setNotice("");
        }}>
          <option value="">{plans.length ? "Select an approved plan" : "No approved plans"}</option>
          {plans.map(plan => <option key={plan.key} value={plan.key}>
            {title(plan)} · {plan.jobName || plan.jobId} · {dayPlanName(plan)} · {plan.labels.length} labels
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
