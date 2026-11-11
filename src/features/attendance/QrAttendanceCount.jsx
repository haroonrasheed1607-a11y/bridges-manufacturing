import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { formatDate, manufacturingToday } from "../../utils/dates.js";

export function QrAttendanceCount({ refreshVersion }) {
  const [summary, setSummary] = React.useState(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let active = true;
    let serial = 0;
    async function load() {
      const ticket = ++serial;
      try {
        const value = await manufacturingApi.rpc("app_qr_attendance_count");
        if (active && ticket === serial) { setSummary(value); setError(""); }
      } catch {
        if (active && ticket === serial) setError("Time In count unavailable.");
      }
    }
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [refreshVersion]);

  if (error) return <small role="alert">{error}</small>;
  const current = summary?.date === manufacturingToday();
  return <div className="qr-attendance-count" role="status" aria-live="polite">
    <strong>{current ? summary.timedIn : "—"}</strong>
    <span>Timed in today<small>{formatDate(current ? summary.date : manufacturingToday())}</small></span>
  </div>;
}
