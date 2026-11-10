import { React } from "../../vendor/react-runtime.js";
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { monday } from "../timesheets/model.js";
import { formatDate, manufacturingDayOffset, manufacturingToday } from "../../utils/dates.js";
import "./payroll-report.css";

const columns = [
  ["number", "Emp. / client no."], ["department", "Dept."], ["name", "Name"],
  ["week1Pieces", "Week 1 pieces"], ["week2Pieces", "Week 2 pieces"],
  ["week1WsPay", "Week 1 WS pay"], ["week2WsPay", "Week 2 WS pay"],
  ["week1Hours", "Week 1 hours"], ["week1WgPay", "Week 1 WG pay"],
  ["week2Hours", "Week 2 hours"], ["week2WgPay", "Week 2 WG pay"],
  ["otherPay", "Other pay"], ["totalPay", "Combined pay"], ["hourlyRate", "Hourly rate"],
  ["jobId", "Job ID"],
];

const hours = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pieces = new Intl.NumberFormat("en-US");
const totalKeys = ["week1Pieces", "week2Pieces", "week1Hours", "week2Hours"];

function displayCell(key, value) {
  if (value == null || value === "") return "—";
  if (key.endsWith("Hours")) return hours.format(value);
  if (key.endsWith("Pieces")) return pieces.format(value);
  return value;
}

function weekLabel(start) {
  return `${formatDate(start)} – ${formatDate(manufacturingDayOffset(start, 6))}`;
}

export function PayrollReport({ api }) {
  const [start, setStart] = React.useState(() => manufacturingDayOffset(monday(manufacturingToday()), -7));
  const [checkDate, setCheckDate] = React.useState("");
  const [report, setReport] = React.useState(null);
  const validStart = Boolean(start) && monday(start) === start;

  React.useEffect(() => {
    if (!validStart) return;
    let active = true;
    setReport(null);
    api.rpc("app_accounts_payroll_report", { p_start: start }).then(rows => {
      if (active) setReport({ start, rows });
    }).catch(error => {
      if (active) setReport({ start, error: error.message });
    });
    return () => { active = false; };
  }, [api, start, validStart]);

  const currentReport = validStart && report?.start === start ? report : null;
  const rows = currentReport?.rows;
  const totals = {};
  for (const row of rows ?? []) {
    for (const key of totalKeys) {
      if (row[key] != null) totals[key] = (totals[key] ?? 0) + row[key];
    }
  }

  return <section className="payroll-report" aria-labelledby="payroll-title">
    <div className="payroll-controls">
      <button type="button" onClick={() => setStart(manufacturingDayOffset(start, -14))} disabled={!validStart}>Previous period</button>
      <label>Week 1 starts (Monday)<input type="date" value={start} onChange={event => setStart(event.target.value)} /></label>
      <button type="button" onClick={() => setStart(manufacturingDayOffset(start, 14))} disabled={!validStart}>Next period</button>
      <label>Check date (optional)<input type="date" value={checkDate} onChange={event => setCheckDate(event.target.value)} /></label>
      <button className="primary" type="button" onClick={() => window.print()} disabled={!rows?.length}>Print report</button>
    </div>
    <article className="payroll-paper">
      <header className="payroll-heading">
        <img src={manufacturingWorkLogo} alt="Bridges" />
        <div>
          <h2 id="payroll-title">Client Payroll Report – All Clients</h2>
          {validStart && <p><b>Week 1</b> {weekLabel(start)} <span><b>Week 2</b> {weekLabel(manufacturingDayOffset(start, 7))}</span></p>}
        </div>
        {checkDate && <p><b>Check date</b> {formatDate(checkDate)}</p>}
      </header>
      <p className="payroll-note">Pieces reflect recorded QR completions. Hours reflect recorded work hours. Pay, department and payroll job IDs are pending payroll setup.</p>
      {!validStart ? <p role="alert">Choose a Monday to start the report.</p>
        : currentReport?.error ? <p role="alert">{currentReport.error}</p>
        : !rows ? <p role="status">Loading payroll report…</p>
        : !rows.length ? <p>No production or attendance records for these weeks.</p>
        : <div className="payroll-scroll" tabIndex={0} role="region" aria-label="Payroll report table">
          <table>
            <thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>{columns.map(([key]) => key === "name"
              ? <th key={key} scope="row">{row.name}</th>
              : <td key={key}>{displayCell(key, row[key])}</td>)}</tr>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={3}>Report totals</th>{columns.slice(3).map(([key]) => <td key={key}>{displayCell(key, totals[key])}</td>)}</tr></tfoot>
          </table>
        </div>}
    </article>
  </section>;
}
