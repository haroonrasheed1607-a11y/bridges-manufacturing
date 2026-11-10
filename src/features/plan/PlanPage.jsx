import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingToday } from "../../utils/dates.js";
import { availableHoursOn } from "../../domain/workforce.js";
import { manufacturingPreviewLabels, manufacturingPrintBoxBatch } from "../../domain/boxLabels.js";

export function PlanPage() {
  const { orders, workforce } = useManufacturing();
  const today = manufacturingToday();
  const [date, setDate] = React.useState(manufacturingToday);
  const [jobId, setJobId] = React.useState("");
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
  const current = jobs.find(item => item.job.id === jobId);
  const savedPeople = labels.filter(label => label.jobId === jobId).map(label => label.personId);
  const otherPeople = new Set(labels.filter(label => label.jobId !== jobId).map(label => label.personId));
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
      setSelected([]);
      setJobId("");
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

  async function save(event) {
    event.preventDefault();
    if (!current || loadedDate !== date || saving.current || busy) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const rows = await manufacturingApi.rpc("app_day_plan", {
        p_date: date,
        p_job: current.job.id,
        p_people: [...selected].sort(),
        p_expected: [...savedPeople].sort(),
      });
      setLabels(rows);
      setNotice(selected.length ? "Plan saved. Stickers are ready to print." : "People removed from this sub-job plan.");
    } catch (e) {
      setError(e.message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function print(preview) {
    const printable = labels.map(label => ({
      order: { id: label.orderId, title: label.orderTitle },
      work: { id: label.workId },
      job: { name: label.workDate.slice(5) + " · " + (label.jobName || "Sub-job") },
      box: { id: label.id, quantity: label.batchQuantity },
      person: { name: label.personName },
    }));
    setError(preview ? manufacturingPreviewLabels(printable) : manufacturingPrintBoxBatch(printable));
  }

  const editable = !busy && loadedDate === date && date >= today;
  const printable = !busy && loadedDate === date && labels.length > 0;
  const changed = selected.length !== savedPeople.length || selected.some(id => !savedPeople.includes(id));
  return <section className="plan-page">
    <header className="plan-heading">
      <div>
        <h2>Plan</h2>
        <p className="quiet">Assign people to a sub-job and print the day’s reusable stickers.</p>
      </div>
      <button type="button" disabled={busy} onClick={load}>Refresh</button>
    </header>
    <form onSubmit={save}>
      <div className="panel plan-toolbar">
        <label className="field">Work date
          <input type="date" required value={date} disabled={busy}
            onChange={e => {
              if (!e.target.value) return;
              setLabels([]);
              setLoadedDate("");
              setSelected([]);
              setJobId("");
              setDate(e.target.value);
            }} />
        </label>
        <label className="field">Sub-job
          <select required value={jobId} disabled={!editable} onChange={e => {
            const id = e.target.value;
            setJobId(id);
            setSelected(labels.filter(label => label.jobId === id).map(label => label.personId));
            setSearch("");
            setNotice("");
          }}>
            <option value="">{jobs.length ? "Select a sub-job" : "No unfinished sub-jobs in production"}</option>
            {jobs.map(({order, work, job}) => <option key={job.id} value={job.id}>
              {order.title} · {work.description} · {job.name} ({job.quantity - job.completed} remaining)
            </option>)}
          </select>
        </label>
      </div>
      {(busy || error || notice || date < today) && <div className="plan-status">
        {busy && <p role="status">{saving.current ? "Saving plan…" : "Loading plan…"}</p>}
        {error && <p role="alert" className="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {date < today && <p className="quiet">Past plans are read-only.</p>}
      </div>}
      <div className="plan-columns">
        <section className="panel plan-pane" aria-labelledby="plan-people-heading">
          <div className="plan-pane-heading">
            <div><h3 id="plan-people-heading">Individuals</h3><small className="quiet">{selected.length} selected</small></div>
            <button className="primary" disabled={!editable || !current || !changed}>
              {selected.length || !savedPeople.length ? "Save plan" : "Clear plan"}
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
        <section className="panel plan-pane" aria-labelledby="plan-stickers-heading">
          <div className="plan-pane-heading">
            <div><h3 id="plan-stickers-heading">Day’s stickers</h3><small className="quiet">{formatDate(date)} · {labels.length} saved</small></div>
            <div className="plan-print-actions">
              <button type="button" disabled={!printable} onClick={() => print(true)}>Preview</button>
              <button type="button" className="primary" disabled={!printable} onClick={() => print(false)}>Print all{labels.length > 0 ? " (" + labels.length + ")" : ""}</button>
            </div>
          </div>
          <div className="plan-list plan-stickers" role="region" aria-label="Saved stickers" tabIndex={0}>
            {labels.length ? <ul>{labels.map(label => <li key={label.id}>
              <strong>{label.personName}</strong>
              <small className="quiet">{label.orderTitle} · {label.jobName || label.jobId}</small>
            </li>)}</ul> : !busy && <p className="quiet">Save a plan to see and print its stickers here.</p>}
          </div>
        </section>
      </div>
    </form>
  </section>;
}
