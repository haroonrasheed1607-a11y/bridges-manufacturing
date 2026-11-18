import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { formatDate, manufacturingToday } from "../../utils/dates.js";

export function PresentWorkers({ refreshVersion, collapsible = false }) {
  const [summary, setSummary] = React.useState(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let active = true, serial = 0;
    async function load() {
      const ticket = ++serial;
      try {
        const value = await manufacturingApi.rpc("app_present_workers");
        if (active && ticket === serial) { setSummary(value); setError(""); }
      } catch { if (active && ticket === serial) setError("Could not load people currently present."); }
    }
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [refreshVersion]);
  const current = summary?.date === manufacturingToday();
  const title = "Currently present" + (current && !error ? " · " + summary.people.length : "");
  const contents = <>
    {error && <p className="alert" role="alert">{error}</p>}
    {current && !error ? <PresentWorkersTable people={summary.people} /> : !error && <p role="status">Loading attendance…</p>}
  </>;
  if (collapsible) return <details className="present-workers">
    <summary>{title}</summary>
    {contents}
  </details>;
  return <section className="present-workers" aria-labelledby="present-workers-title">
    <div className="section-heading"><h3 id="present-workers-title">{title}</h3>
      <small>{formatDate(manufacturingToday())}</small></div>
    {contents}
  </section>;
}
export function PresentWorkersTable({ people }) {
  if (!people.length) return <p className="quiet">No individuals are currently timed in.</p>;
  return <div className="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Time in</th></tr></thead>
    <tbody>{people.map(person => <tr key={person.id}><td>{person.number || "—"}</td><td>{person.name}</td><td>{person.timeIn}</td></tr>)}</tbody>
  </table></div>;
}
