import { React } from '../../vendor/react-runtime.js';
import { manufacturingApi } from '../../api/supabaseClient.js';
import { manufacturingToday } from '../../utils/dates.js';

export function ScannerDailyWork({refreshKey}) {
  const [date, setDate] = React.useState(manufacturingToday), [rows, setRows] = React.useState([]),
    [error, setError] = React.useState(''), [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await manufacturingApi.rpc('app_scanner_daily_work', {p_date:date});
        if (!cancelled) { setRows(result); setError(''); }
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    }
    setRows([]); setLoading(true); load();
    const timer = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [date, refreshKey]);
  return <section className="panel">
    <h2>Completed work</h2>
    <label className="field">Day (Tulsa time)<input type="date" required value={date} onChange={e => { if(e.target.value) setDate(e.target.value); }}/></label>
    <p className="quiet">Most pieces completed first · boxes and reusable loads</p>
    {error ? <p role="alert" className="alert">{error}</p> : loading ? <p role="status">Loading completed work…</p> : rows.length ? <div className="scanner-recent-list">{rows.map(row => <article key={row.personId}><div><strong>{row.name}</strong><p>{Number(row.pieces).toLocaleString()} pieces completed</p><small>{row.completions} completed scans</small></div></article>)}</div> : <p>No completed work for this day.</p>}
  </section>;
}
