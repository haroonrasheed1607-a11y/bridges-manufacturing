import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";

const pageSize = 50;
const empty = { total: 0, pieces: 0, rows: [] };

export function ScanHistory() {
  const { orders, workforce, orderDisplayTitle } = useManufacturing();
  const [filters, setFilters] = React.useState(() => {
    const today = manufacturingToday();
    return { start: today, end: today, kind: "all", person: "", order: "", search: "" };
  });
  const [query, setQuery] = React.useState(filters);
  const [offset, setOffset] = React.useState(0);
  const [history, setHistory] = React.useState(empty);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState("");
  const generation = React.useRef(0);

  async function load() {
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await manufacturingApi.rpc("app_scan_history", {
        p_start: query.start, p_end: query.end, p_kind: query.kind,
        p_person: query.person || null, p_order: query.order || null,
        p_search: query.search.trim(), p_offset: offset,
      });
      if (ticket === generation.current) setHistory(result);
    } catch (e) {
      if (ticket === generation.current) {
        setHistory(empty);
        setError(e.message);
      }
    } finally {
      if (ticket === generation.current) setBusy(false);
    }
  }

  React.useEffect(() => {
    load();
    return () => { generation.current++; };
  }, [query, offset]);

  function change(key, value) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  return <section className="panel" aria-labelledby="scan-history-heading">
    <h3 id="scan-history-heading">Scan history</h3>
    <form onSubmit={event => {
      event.preventDefault();
      setOffset(0);
      setQuery({ ...filters });
    }}>
      <div className="form-grid">
        <label className="field"><span>From date</span>
          <input type="date" required max={filters.end} value={filters.start} onChange={e => change("start", e.target.value)} />
        </label>
        <label className="field"><span>Through date</span>
          <input type="date" required min={filters.start} value={filters.end} onChange={e => change("end", e.target.value)} />
        </label>
        <label className="field"><span>QR type</span>
          <select value={filters.kind} onChange={e => change("kind", e.target.value)}>
            <option value="all">All types</option><option value="box">Single-use</option><option value="reusable">Reusable</option>
          </select>
        </label>
        <label className="field"><span>Individual</span>
          <select value={filters.person} onChange={e => change("person", e.target.value)}>
            <option value="">All individuals</option>
            {workforce.people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Order</span>
          <select value={filters.order} onChange={e => change("order", e.target.value)}>
            <option value="">All orders</option>
            {orders.map(order => <option key={order.id} value={order.id}>{orderDisplayTitle(order)} · {order.id}</option>)}
          </select>
        </label>
        <label className="field"><span>Search</span>
          <input type="search" maxLength={160} value={filters.search}
            placeholder="QR, name, order or sub-job" onChange={e => change("search", e.target.value)} />
        </label>
      </div>
      <button type="submit" className="primary" disabled={busy}>Apply filters</button>
    </form>
    {error && <p className="alert" role="alert">{error}</p>}
    <p role="status" className="quiet">{busy ? "Loading scan history…" :
      history.total.toLocaleString() + " records · " + history.pieces.toLocaleString() + " pieces"}</p>
    {!busy && history.rows.length > 0 && <div className="table-wrap" tabIndex={0} role="region" aria-label="Scan history table">
      <table>
        <thead><tr><th>Recorded at</th><th>Individual</th><th>Order / sub-job</th><th>QR code</th><th>Type / source</th><th>Pieces</th></tr></thead>
        <tbody>{history.rows.map(row => <tr key={row.kind + ":" + row.id}>
          <td>{formatTimestamp(row.completed_at)}</td>
          <td>{row.person}</td>
          <td>{row.title}{row.code ? " · " + row.code : ""}<small className="block quiet">{row.sub_job || row.work_id} · {row.order_id}</small></td>
          <td>{row.qr}</td>
          <td>{row.kind === "box" ? "Single-use" : "Reusable"}<small className="block quiet">{row.source}</small></td>
          <td>{row.pieces.toLocaleString()}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {!busy && !error && !history.total && <p className="quiet">No scan records match these filters.</p>}
    {(offset > 0 || history.total > pageSize) && <div className="form-actions">
      <button type="button" disabled={busy || offset === 0} onClick={() => setOffset(offset - pageSize)}>Previous</button>
      <button type="button" disabled={busy || offset + pageSize >= history.total} onClick={() => setOffset(offset + pageSize)}>Next</button>
    </div>}
  </section>;
}
