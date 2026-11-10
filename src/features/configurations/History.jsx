import { manufacturingApi } from "../../api/supabaseClient.js";
import { formatDate, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";

const views = [
  ["scans", "All QR scans", "Recorded date"],
  ["customers", "Clients", "Date added"],
  ["customer_items", "Client items"],
  ["orders", "Orders", "Date created"],
  ["work_orders", "Work orders", "Production start or order date"],
  ["sub_jobs", "Sub-jobs", "Production start or order date"],
  ["boxes", "Single-use QR boxes", "Date created"],
  ["production_records", "Single-use completions", "Recorded date"],
  ["dumping_assignments", "Reusable QR assignments and plans", "Plan or assignment date"],
  ["dumping_completions", "Reusable scans", "Recorded date"],
  ["people", "Individuals and Job Coaches"],
  ["staff_profiles", "Staff profiles", "Date added"],
  ["bookings", "Work bookings", "Booking start"],
  ["individual_availability", "Individual availability", "Availability date"],
  ["daily_attendance", "Daily attendance", "Attendance date"],
  ["individual_timesheets", "Timesheets", "Week starting"],
  ["quality_checks", "Quality checks", "Check date"],
  ["packing_checks", "Packing checks", "Check date"],
  ["order_events", "Order activity", "Event date"],
  ["workforce_changes", "Workforce changes", "Change date"],
  ["barcode_approval_batches", "QR approval batches", "Approval date"],
  ["order_schedules", "Repeat order schedules", "Next due date"],
  ["calendar_exceptions", "Calendar exceptions", "Exception date"],
  ["calendar_settings", "Calendar settings"],
];

const pageSize = 50;
const maxOffset = 1000000;
const empty = { columns: [], total: 0, rows: [] };

function defaultFilters(view) {
  const date = view === "scans" ? manufacturingToday() : "";
  return { view, start: date, end: date, search: "" };
}

function cellText(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
  return typeof value === "string" ? value : "—";
}

export function History() {
  const [filters, setFilters] = React.useState(() => defaultFilters("scans"));
  const [query, setQuery] = React.useState(filters);
  const [offset, setOffset] = React.useState(0);
  const [history, setHistory] = React.useState(empty);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const generation = React.useRef(0);

  React.useEffect(() => {
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    async function load() {
      try {
        const result = await manufacturingApi.rpc("app_configuration_history", {
          p_view: query.view, p_start: query.start || null, p_end: query.end || null,
          p_search: query.search.trim(), p_offset: offset,
        });
        if (ticket === generation.current) {
          setHistory(result);
          const last = Math.floor(Math.max(0, result.total - 1) / pageSize) * pageSize;
          if (offset > last) setOffset(last);
        }
      } catch (e) {
        if (ticket === generation.current) {
          setHistory(empty);
          setError(e.message);
        }
      } finally {
        if (ticket === generation.current) setBusy(false);
      }
    }
    load();
    return () => { generation.current++; };
  }, [query, offset]);

  function apply(next) {
    setBusy(true);
    setOffset(0);
    setQuery({ ...next });
  }

  function change(key, value) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  const [, label, dateLabel] = views.find(([id]) => id === filters.view);
  const page = offset / pageSize + 1;
  const pageCount = Math.ceil(history.total / pageSize);
  const lastOffset = Math.min(maxOffset, Math.max(0, (pageCount - 1) * pageSize));

  return <section className="panel" aria-labelledby="configuration-history-heading">
    <h3 id="configuration-history-heading">History</h3>
    <form onSubmit={event => { event.preventDefault(); apply(filters); }}>
      <div className="form-grid">
        <label className="field"><span>View</span>
          <select value={filters.view} onChange={event => {
            const next = defaultFilters(event.target.value);
            setHistory(empty);
            setFilters(next);
            apply(next);
          }}>
            {views.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
          </select>
        </label>
        <label className="field"><span>From date</span>
          <input type="date" disabled={!dateLabel} max={filters.end} value={filters.start} onChange={e => change("start", e.target.value)} />
          <small>{dateLabel || "This view has no record dates."}</small>
        </label>
        <label className="field"><span>Through date</span>
          <input type="date" disabled={!dateLabel} min={filters.start} value={filters.end} onChange={e => change("end", e.target.value)} />
        </label>
        <label className="field"><span>Search</span>
          <input type="search" maxLength={160} value={filters.search}
            placeholder="Search this view" onChange={e => change("search", e.target.value)} />
        </label>
      </div>
      <button type="submit" className="primary" disabled={busy}>Apply filters</button>
    </form>
    {error && <p className="alert" role="alert">{error}</p>}
    <p role="status" className="quiet">{busy ? "Loading history…" : history.total.toLocaleString() + " records" +
      (history.pieces == null ? "" : " · " + history.pieces.toLocaleString() + " pieces")}</p>
    {!busy && !error && <div className="table-wrap" tabIndex={0} role="region" aria-label={label + " history table"}>
      <table>
        <thead><tr>{dateLabel && <th scope="col">{dateLabel}</th>}{history.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody>{history.rows.map(row => <tr key={row.row_key}>
          {dateLabel && <td>{formatDate(row.event_date)}</td>}
          {row.cells.map((value, index) => <td key={history.columns[index]}>{cellText(value)}</td>)}
        </tr>)}</tbody>
      </table>
    </div>}
    {!busy && !error && !history.total && <p className="quiet">No records match these filters.</p>}
    {history.total > 0 && <nav className="scan-history-pagination" aria-label="History pagination">
      <p className="quiet" aria-live="polite">
        {busy ? "Loading page…" : `Page ${page} of ${pageCount} · Showing ${offset + 1}–${offset + history.rows.length} of ${history.total.toLocaleString()} records`}
      </p>
      <div>
        <button type="button" disabled={busy || offset === 0} onClick={() => setOffset(0)}>First</button>
        <button type="button" disabled={busy || offset === 0} onClick={() => setOffset(offset - pageSize)}>Previous</button>
        <button type="button" disabled={busy || offset >= lastOffset} onClick={() => setOffset(offset + pageSize)}>Next</button>
        <button type="button" disabled={busy || offset >= lastOffset} onClick={() => setOffset(lastOffset)}>Last</button>
      </div>
    </nav>}
  </section>;
}
