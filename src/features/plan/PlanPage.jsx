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

  return <section className="panel">
    <h2>Plan</h2>
    <p>Choose a date and sub-job, then select the people who will work on it. They share the sub-job balance.</p>
    <form onSubmit={save}>
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
      <fieldset disabled={busy || loadedDate !== date || date < today}>
        <label className="field">Sub-job
          <select required value={jobId} onChange={e => {
            const id = e.target.value;
            setJobId(id);
            setSelected(labels.filter(label => label.jobId === id).map(label => label.personId));
            setSearch("");
            setNotice("");
          }}>
            <option value="">Select a sub-job</option>
            {jobs.map(({order, work, job}) => <option key={job.id} value={job.id}>
              {order.title} · {work.description} · {job.name} ({job.quantity - job.completed} remaining)
            </option>)}
          </select>
        </label>
        {current && <fieldset>
          <legend>Individuals · {selected.length} selected</legend>
          <label className="field">Search individuals
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <div className="table-wrap" style={{maxHeight:"18rem",overflow:"auto"}}>
            {people.map(person => {
              const alreadyPlanned = otherPeople.has(person.id);
              const checked = selected.includes(person.id);
              const hours = availableHoursOn(person, date);
              return <label key={person.id} style={{display:"block",padding:"6px"}}>
                <input type="checkbox" checked={checked}
                  disabled={alreadyPlanned || (person.active === false && !checked)}
                  onChange={e => setSelected(ids => e.target.checked ? [...ids,person.id] : ids.filter(id => id !== person.id))} />
                {" " + person.name}
                <small className="quiet"> · {alreadyPlanned ? "On another plan" : person.active === false ? "Disabled" : hours + " h scheduled"}</small>
              </label>;
            })}
            {!people.length && <p>No matching individuals.</p>}
          </div>
        </fieldset>}
        <div className="form-actions">
          <button className="primary" disabled={!current || (!selected.length && !savedPeople.length)}>
            {selected.length || !savedPeople.length ? "Save plan" : "Clear sub-job plan"}
          </button>
        </div>
      </fieldset>
    </form>
    {date < today && <p className="quiet">Past plans are read-only.</p>}
    {busy && <p role="status">Loading plan…</p>}
    {error && <p role="alert" className="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <h3>Stickers for {formatDate(date)}</h3>
    <div className="form-actions">
      <button type="button" disabled={busy} onClick={load}>Refresh plan</button>
      <button type="button" disabled={busy || !labels.length} onClick={() => print(true)}>Preview day’s stickers</button>
      <button type="button" className="primary" disabled={busy || !labels.length} onClick={() => print(false)}>Print all {labels.length || ""} stickers</button>
    </div>
    {labels.length ? <div className="table-wrap"><table>
      <thead><tr><th>Individual</th><th>Order</th><th>Sub-job</th></tr></thead>
      <tbody>{labels.map(label => <tr key={label.id}>
        <td>{label.personName}</td><td>{label.orderTitle}</td><td>{label.jobName || label.jobId}</td>
      </tr>)}</tbody>
    </table></div> : !busy && <p>No stickers saved for this date.</p>}
  </section>;
}
