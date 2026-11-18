import { createPortal } from "react-dom";
import { formatDate } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingToday } from "../../utils/dates.js";

export function ShopFloorDashboard({ refreshVersion }) {
  const [date, setDate] = React.useState(manufacturingToday);
  const [result, setResult] = React.useState(null);
  const [printError, setPrintError] = React.useState("");
  const rows = result?.date === date ? result.rows : null;
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    let serial = 0;
    async function load() {
      const ticket = ++serial;
      try {
        const value = await manufacturingApi.rpc("app_shop_floor_dashboard", { p_date: date });
        if (active && ticket === serial) { setResult({ date, rows: value }); setError(""); }
      } catch (problem) { if (active && ticket === serial) setError(problem.message); }
    }
    setResult(null);
    setError("");
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [refreshVersion, date]);

  function printReport() {
    setPrintError("");
    document.body.classList.add("printing-daily-production");
    function cleanup() {
      document.body.classList.remove("printing-daily-production");
      window.removeEventListener("afterprint", cleanup);
    }
    window.addEventListener("afterprint", cleanup);
    try { window.print(); }
    catch { cleanup(); setPrintError("Could not open the print dialog. Please try again."); }
  }

  React.useEffect(() => () => document.body.classList.remove("printing-daily-production"), []);

  return <section className="panel shop-floor-dashboard" aria-label="Daily production">
    <div className="section-heading">
      <h2>Daily production</h2>
      <label className="field">Work date<input type="date" value={date} max={manufacturingToday()}
        onChange={event => { if (event.target.value) { setDate(event.target.value); setPrintError(""); } }} /></label>
      <button type="button" onClick={printReport} disabled={!rows || Boolean(error)}>
        Print production report
      </button>
    </div>
    {printError && <p className="alert" role="alert">{printError}</p>}
    {error ? <p role="alert" className="alert">{error}</p>
      : !rows ? <p role="status">Loading completed quantity…</p>
        : <ProductionTable rows={rows} />}
    {rows && !error && typeof document !== "undefined" && createPortal(
      <div className="daily-production-print">
        <style>{`
          .daily-production-print { display: none; }
          @media print {
            body.printing-daily-production > :not(.daily-production-print) { display: none !important; }
            body.printing-daily-production > .daily-production-print { display: block !important; color: #000; }
            .daily-production-print table { width: 100%; border-collapse: collapse; }
            .daily-production-print thead { display: table-header-group; }
            .daily-production-print tr { break-inside: avoid; }
            .daily-production-print th, .daily-production-print td { padding: 6px; border-bottom: 1px solid #bbb; text-align: left; }
            .daily-production-print .verification { break-inside: avoid; margin-top: 24px; }
          }
        `}</style>
        <h1>Shop Floor Daily Production</h1>
        <p>{formatDate(date)} · Tulsa local time</p>
        <ProductionTable rows={rows} />
        <p className="verification">Verified by: ________________________ &nbsp; Date: ______________</p>
      </div>, document.body
    )}
  </section>;
}


function ProductionTable({ rows }) {
  if (!rows.length) return <p>No approved orders or completed quantities for this day.</p>;
  return <table>
    <thead><tr><th scope="col">Order</th><th scope="col">Completed quantity</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.id}>
      <th scope="row">{row.title}{row.code && <small className="block quiet">{row.code}</small>}</th>
      <td>{Number(row.pieces).toLocaleString()} {row.billableMode ? "billable units" : "legacy pieces"}</td>
    </tr>)}</tbody>
  </table>;
}
