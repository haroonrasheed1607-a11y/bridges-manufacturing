import { downloadDailyProductionPdf } from "./dailyProductionPdf.js";
import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingToday } from "../../utils/dates.js";

export function ShopFloorDashboard({ refreshVersion }) {
  const [date, setDate] = React.useState(manufacturingToday);
  const [result, setResult] = React.useState(null);
  const [printing, setPrinting] = React.useState(false);
  const [pdfError, setPdfError] = React.useState("");
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

  async function download() {
    if (printing || !rows || error) return;
    setPrinting(true);
    setPdfError("");
    try { await downloadDailyProductionPdf(date, rows); }
    catch { setPdfError("Could not create the production PDF. Please try again."); }
    finally { setPrinting(false); }
  }

  return <section className="panel shop-floor-dashboard" aria-label="Daily production">
    <div className="section-heading">
      <h2>Daily production</h2>
      <label className="field">Work date<input type="date" value={date} max={manufacturingToday()}
        onChange={event => { if (event.target.value) { setDate(event.target.value); setPdfError(""); } }} /></label>
      <button type="button" onClick={download} disabled={!rows || Boolean(error) || printing}>
        {printing ? "Creating PDF…" : "Download production PDF"}
      </button>
    </div>
    {pdfError && <p className="alert" role="alert">{pdfError}</p>}
    {error ? <p role="alert" className="alert">{error}</p>
      : !rows ? <p role="status">Loading completed quantity…</p>
        : !rows.length ? <p>No approved orders or completed quantities for this day.</p>
          : <table>
            <thead><tr><th scope="col">Order</th><th scope="col">Completed quantity</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <th scope="row">{row.title}{row.code && <small className="block quiet">{row.code}</small>}</th>
              <td>{Number(row.pieces).toLocaleString()} {row.billableMode ? "billable units" : "legacy pieces"}</td>
            </tr>)}</tbody>
          </table>}
  </section>;
}
