import { manufacturingApi } from "../../api/supabaseClient.js";
import { jobCompletion } from "../../domain/jobCompletion.js";
import { manufacturingBoardStage, manufacturingBoardStages } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, formatTimestamp, manufacturingDayOffset, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";

const number = value => Number(value).toLocaleString();

function TopPerformers({ performers }) {
  return <section className="panel" aria-labelledby="dashboard-performers-heading">
    <h3 id="dashboard-performers-heading">Top performers</h3>
    <p className="quiet">Ranked by pieces scanned in the selected period.</p>
    {performers.length ? <div className="table-wrap"><table>
      <thead><tr><th scope="col">Rank</th><th scope="col">Individual</th><th scope="col">Pieces</th><th scope="col">Scans</th></tr></thead>
      <tbody>{performers.map((person, index) => <tr key={person.id}>
        <td>{index + 1}</td><th scope="row">{person.name}</th>
        <td><strong>{number(person.pieces)}</strong></td><td>{number(person.scans)}</td>
      </tr>)}</tbody>
    </table></div> : <p className="quiet">No QR scans in this period.</p>}
  </section>;
}

function ManufacturingDashboard() {
  const { orders, open, setView, orderDisplayTitle } = useManufacturing();
  const today = manufacturingToday();
  const [end, setEnd] = React.useState(manufacturingToday);
  const [days, setDays] = React.useState(1);
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const request = React.useRef(0);
  const active = orders.filter(order => order.stage < 6);
  const overdue = active.filter(order => order.required && order.required < today);
  const plannedIds = new Set(result?.plannedDate === end ? result.plannedOrderIds : []);
  const watch = orders.filter(order => plannedIds.has(order.id))
    .sort((a, b) => (a.required || "9999").localeCompare(b.required || "9999") || a.id.localeCompare(b.id));
  const stages = manufacturingBoardStages.map((label, index) => ({
    label, count: orders.filter(order => manufacturingBoardStage(order) === index).length,
  }));
  const dateRange = days === 1 ? formatDate(end) : formatDate(manufacturingDayOffset(end, 1 - days)) + " – " + formatDate(end);

  async function load() {
    const ticket = ++request.current;
    setBusy(true);
    setError("");
    try {
      const data = await manufacturingApi.rpc("app_dashboard_production", { p_end: end, p_days: days });
      if (ticket === request.current) setResult(data);
    } catch (e) {
      if (ticket === request.current) {
        setResult(null);
        setError(e.message);
      }
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  }

  React.useEffect(() => {
    load();
    return () => { request.current++; };
  }, [end, days]);

  return <div className="manufacturing-dashboard">
    <header className="page-heading">
      <div><h2>Production dashboard</h2><p className="quiet">QR output, individual performance, and planned orders.</p></div>
      <button type="button" onClick={() => setView("board")}>Open Job Board</button>
    </header>
    <div className="panel dashboard-filters">
      <label className="field"><span>Scan period</span>
        <select value={days} onChange={event => setDays(Number(event.target.value))}>
          <option value={1}>Single day</option><option value={7}>7 days</option><option value={30}>30 days</option>
        </select>
      </label>
      <label className="field"><span>Ending date</span>
        <input type="date" max={today} value={end} onChange={event => event.target.value && setEnd(event.target.value)} />
      </label>
      <button type="button" onClick={() => { setEnd(today); setDays(1); }}>Today</button>
      <button type="button" disabled={busy} onClick={load}>Refresh scans</button>
    </div>
    <section aria-label="Scan activity" aria-busy={busy}>
      <div className="dashboard-scan-heading">
        <h3>Scan activity</h3><p className="quiet">{dateRange} · Tulsa time</p>
      </div>
      {busy && <p role="status" className="quiet">Loading scan activity…</p>}
      {error && <p role="alert" className="alert">{error}</p>}
      {!busy && result && <>
        <div className="metrics dashboard-metrics">
          {[["Total pieces done", Number(result.pieces) + Number(result.approvedPieces)], ["QR scans", result.scans], ["Individuals who scanned", result.individuals],
            ["Pieces from admin approvals", result.approvedPieces]].map(([label, value]) =>
            <div key={label}><span>{label}</span><strong>{number(value)}</strong></div>)}
        </div>
        {result.latestScan && <p className="quiet dashboard-last-scan">Latest scan {formatTimestamp(result.latestScan)}</p>}
        <TopPerformers performers={result.performers} />
      </>}
    </section>
    <section aria-label="Current order status">
      <div className="dashboard-scan-heading"><h3>Current order status</h3><p className="quiet">All orders, independent of the scan period</p></div>
      <div className="metrics dashboard-metrics">
        {[["Active orders", active.length], ["In production", orders.filter(order => order.stage === 1).length],
          ["Overdue orders", overdue.length], ["Completed orders", stages.at(-1).count]].map(([label, value]) =>
          <div key={label}><span>{label}</span><strong>{number(value)}</strong></div>)}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h3>Orders to watch</h3><p className="quiet">Planned for {formatDate(end)}.</p>
          {busy ? <p className="quiet">Loading planned orders…</p> :
            error ? <p className="quiet">Could not load planned orders.</p> : watch.length ? <div className="table-wrap"><table>
            <thead><tr><th scope="col">Order</th><th scope="col">Stage</th><th scope="col">Due date</th><th scope="col">Pieces remaining</th></tr></thead>
            <tbody>{watch.map(order => {
              const { total, completed } = jobCompletion(order);
              return <tr key={order.id}>
                <td><button className="text-link" type="button" onClick={() => open(order.id)}>{orderDisplayTitle(order)}</button></td>
                <td>{manufacturingBoardStages[manufacturingBoardStage(order)]}</td>
                <td>{formatDate(order.required)}{order.stage < 6 && order.required && order.required < today && <span className="badge red dashboard-overdue">Overdue</span>}</td>
                <td>{number(Math.max(Number(order.quantity) || 0, total) - completed)}</td>
              </tr>;
            })}</tbody>
          </table></div> : <p className="quiet">No orders are planned for this date.</p>}
        </section>
        <section className="panel">
          <h3>Orders by stage</h3>
          <dl className="dashboard-stages">{stages.map(({ label, count }) =>
            <div key={label}><dt>{label}</dt><dd>{number(count)}</dd></div>)}</dl>
        </section>
      </div>
    </section>
  </div>;
}

export { ManufacturingDashboard };
