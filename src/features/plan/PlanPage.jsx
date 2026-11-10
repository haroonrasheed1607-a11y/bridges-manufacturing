import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingToday } from "../../utils/dates.js";
import { availableHoursOn } from "../../domain/workforce.js";
import { dayPlanKey, dayPlanLabelIds, dayPlanName, groupDayPlans } from "./dayPlan.js";

export function PlanPage() {
  const { orders, workforce, orderDisplayTitle } = useManufacturing();
  const today = manufacturingToday();
  const [date, setDate] = React.useState(manufacturingToday);
  const [jobId, setJobId] = React.useState("");
  const [target, setTarget] = React.useState(null);
  const [selected, setSelected] = React.useState([]);
  const [labels, setLabels] = React.useState([]);
  const [loadedDate, setLoadedDate] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const request = React.useRef(0);
  const saving = React.useRef(false);
  const jobs = orders.filter(o => o.stage === 1).flatMap(order =>
    order.workOrders.flatMap(work => work.jobs.filter(job => job.completed < job.quantity)
      .map(job => ({ order, work, job }))));
  const plans = groupDayPlans(labels);
  const current = jobs.find(item => item.job.id === jobId);
  const savedPlan = target && plans.find(plan => plan.key === target.key);
  const savedPeople = savedPlan?.labels.map(label => label.personId) ?? [];
  const otherPeople = new Set(labels.filter(label => dayPlanKey(label) !== target?.key).map(label => label.personId));

  function selectPlan(id, plan = null) {
    setJobId(id);
    const planId = plan ? plan.planId ?? null : id ? crypto.randomUUID() : null;
    setTarget(id ? { planId, key: dayPlanKey({ jobId: id, planId }) } : null);
    setSelected(plan?.labels.map(label => label.personId) ?? []);
    setSearch("");
    setNotice("");
  }
  const people = workforce.people.filter(person =>
    person.kind === "individual" && (person.active !== false || savedPeople.includes(person.id))
    && person.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function load() {
    const ticket = ++request.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const rows = await manufacturingApi.rpc("app_day_plan", { p_date: date });
      if (ticket !== request.current) return;
      setLabels(rows);
      setLoadedDate(date);
      selectPlan("");
    } catch (e) {
      if (ticket === request.current) setError(e.message);
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  }

  React.useEffect(() => {
    load();
    return () => { request.current++; };
  }, [date]);

  async function move(event) {
    event.preventDefault();
    if (!current || !target || loadedDate !== date || saving.current || busy) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const rows = await manufacturingApi.rpc("app_move_day_plan", {
        p_date: date,
        p_job: current.job.id,
        p_plan: target.planId,
        p_people: [...selected].sort(),
        p_expected: [...savedPeople].sort(),
      });
      setLabels(rows);
      if (!selected.length) selectPlan(jobId);
      setNotice(selected.length ? "Plan updated. Approve it when ready to print." : "Plan cleared.");
    } catch (e) {
      setError(e.message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  async function approve(plan) {
    if (!editable || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const rows = await manufacturingApi.rpc("app_approve_day_plan_group", {
        p_date: date,
        p_job: plan.jobId,
        p_plan: plan.planId ?? null,
        p_expected: dayPlanLabelIds(plan),
      });
      setLabels(rows);
      setNotice("Approved. This plan is ready in Shop Floor Print.");
    } catch (e) {
      setError(e.message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const editable = !busy && loadedDate === date && date >= today;
  const changed = selected.length !== savedPeople.length || selected.some(id => !savedPeople.includes(id));
  return <section className="plan-page">
    <header className="plan-heading">
      <div>
        <h2>Plan</h2>
        <p className="quiet">Create multiple plans for a sub-job, or add people to a saved plan before approving it.</p>
      </div>
      <button type="button" disabled={busy} onClick={load}>Refresh</button>
    </header>
    <form onSubmit={move}>
      <div className="panel plan-toolbar">
        <label className="field">Work date
          <input type="date" required value={date} disabled={busy}
            onChange={e => {
              if (!e.target.value) return;
              setLabels([]);
              setLoadedDate("");
              selectPlan("");
              setDate(e.target.value);
            }} />
        </label>
        <label className="field">Sub-job
          <select required value={jobId} disabled={!editable} onChange={e => selectPlan(e.target.value)}>
            <option value="">{jobs.length ? "Select a sub-job" : "No unfinished sub-jobs in production"}</option>
            {jobs.map(({order, work, job}) => <option key={job.id} value={job.id}>
              {orderDisplayTitle(order)} · {work.description} · {job.name} ({job.quantity - job.completed} remaining)
            </option>)}
          </select>
        </label>
      </div>
      {(busy || error || notice || date < today) && <div className="plan-status">
        {busy && <p role="status">{saving.current ? "Updating plan…" : "Loading plan…"}</p>}
        {error && <p role="alert" className="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {date < today && <p className="quiet">Past plans are read-only.</p>}
      </div>}
      <div className="plan-columns">
        <section className="panel plan-pane" aria-labelledby="plan-people-heading">
          <div className="plan-pane-heading">
            <div>
              <h3 id="plan-people-heading">{savedPlan ? "Edit " + dayPlanName(savedPlan) : "Individuals · New plan"}</h3>
              <small className="quiet">{selected.length} selected</small>
            </div>
            {savedPlan && <button type="button" disabled={!editable} onClick={() => selectPlan(jobId)}>New plan</button>}
            <button className="primary" disabled={!editable || !current || !changed}>
              {!selected.length && savedPlan ? "Clear plan" : savedPlan ? "Update plan" : "Move →"}
            </button>
          </div>
          <label className="field plan-search">Search individuals
            <input type="search" value={search} disabled={!current || !editable} onChange={e => setSearch(e.target.value)} />
          </label>
          <div className="plan-list plan-people" role="region" aria-label="Individuals for selected sub-job" tabIndex={0}>
            {!current ? <p className="quiet">Select a sub-job to choose individuals.</p> : people.length ? people.map(person => {
              const alreadyPlanned = otherPeople.has(person.id);
              const checked = selected.includes(person.id);
              const hours = availableHoursOn(person, date);
              return <label className="plan-person" key={person.id}>
                <input type="checkbox" checked={checked}
                  disabled={!editable || alreadyPlanned || (person.active === false && !checked)}
                  onChange={e => setSelected(ids => e.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id))} />
                <span className="plan-person-name">
                  <strong>{person.name}</strong>
                  {(alreadyPlanned || person.active === false) &&
                    <small className="quiet">{person.active === false ? "Disabled" : "On another plan"}</small>}
                </span>
                <span className="plan-person-hours">{hours.toLocaleString()} h available</span>
              </label>;
            }) : <p className="quiet">No matching individuals.</p>}
          </div>
        </section>
        <section className="panel plan-pane" aria-labelledby="plan-approval-heading">
          <div className="plan-pane-heading">
            <div><h3 id="plan-approval-heading">Plans for approval</h3><small className="quiet">{formatDate(date)} · {plans.length} plans</small></div>
          </div>
          <div className="plan-list plan-stickers" role="region" aria-label="Plans for approval" tabIndex={0}>
            {plans.length ? <ul>{plans.map(plan => {
              const approved = plan.labels.every(label => label.approvedAt);
              return <li key={plan.key} className="plan-approval-row">
                <div>
                  <strong>{orderDisplayTitle(orders.find(order => order.id === plan.orderId) ?? { title: plan.orderTitle })}</strong>
                  <small className="quiet">{plan.jobName || plan.jobId} · {dayPlanName(plan)} · {plan.labels.length} individuals</small>
                  <small className="quiet">{plan.labels.map(label => label.personName).join(", ")}</small>
                </div>
                <div className="plan-print-actions">
                  <button type="button" disabled={!editable} onClick={() => selectPlan(plan.jobId, plan)}>Edit plan</button>
                  {approved ? <span className="badge green">Approved</span> :
                    <button type="button" className="primary" disabled={!editable} onClick={() => approve(plan)}>Approve</button>}
                </div>
              </li>;
            })}</ul> : !busy && <p className="quiet">Move selected individuals here to approve their plan.</p>}
          </div>
        </section>
      </div>
    </form>
  </section>;
}
