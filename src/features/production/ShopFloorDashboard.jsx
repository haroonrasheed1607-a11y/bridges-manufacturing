import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingToday } from "../../utils/dates.js";

export function ShopFloorDashboard({ refreshVersion }) {
  const [rows, setRows] = React.useState(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    let serial = 0;
    async function load() {
      const ticket = ++serial;
      try {
        const value = await manufacturingApi.rpc("app_shop_floor_dashboard", { p_date: manufacturingToday() });
        if (active && ticket === serial) { setRows(value); setError(""); }
      } catch (problem) { if (active && ticket === serial) setError(problem.message); }
    }
    setRows(null);
    setError("");
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [refreshVersion]);

  return <section className="panel shop-floor-dashboard" aria-label="Orders and pieces scanned today">
    {error ? <p role="alert" className="alert">{error}</p>
      : !rows ? <p role="status">Loading scanned pieces…</p>
        : !rows.length ? <p>No approved orders or scanned pieces today.</p>
          : <table>
            <thead><tr><th scope="col">Order</th><th scope="col">Pieces scanned today</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <th scope="row">{row.title}{row.code && <small className="block quiet">{row.code}</small>}</th>
              <td>{Number(row.pieces).toLocaleString()}</td>
            </tr>)}</tbody>
          </table>}
  </section>;
}
