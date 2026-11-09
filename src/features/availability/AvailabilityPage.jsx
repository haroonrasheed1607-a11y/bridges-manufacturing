import { React } from "../../vendor/react-runtime.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingToday } from "../../utils/dates.js";
import { availableHoursOn, manufacturingBookedDay } from "../../domain/workforce.js";
import {
  availabilityDates,
  availabilityFor,
  availabilitySummary,
} from "./model.js";
export function AvailabilityPage() {
  const { workforce, orders } = useManufacturing(),
    people = workforce.people.filter((p) => p.kind === "individual" && p.active !== false);
  const [start, setStart] = React.useState(manufacturingToday),
    [days, setDays] = React.useState(7),
    [records, setRecords] = React.useState([]),
    [person, setPerson] = React.useState(people[0]?.id || ""),
    [from, setFrom] = React.useState(manufacturingToday),
    [to, setTo] = React.useState(manufacturingToday),
    [status, setStatus] = React.useState("available"),
    [hours, setHours] = React.useState(6),
    [weekdays, setWeekdays] = React.useState([1, 2, 3, 4, 5]),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [notice, setNotice] = React.useState("");
  const dates = availabilityDates(start, days),
    generation = React.useRef(0);
  async function load() {
    const n = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const r = await manufacturingApi.rpc("app_availability", {
        p_start: start,
        p_end: dates.at(-1),
      });
      if (n === generation.current) setRecords(r);
    } catch (e) {
      if (n === generation.current) setError(e.message);
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, [start, days]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await manufacturingApi.rpc("app_availability", {
        p_start: from,
        p_end: to,
        p_person: person,
        p_status: status,
        p_hours: status === "available" ? Number(hours) : 0,
        p_weekdays: weekdays,
      });
      setNotice("Availability saved.");
      await load();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="page-heading">
        <div>
          <h2>Individual availability</h2>
          <p>
            Reported availability for future planning. Bookings are shown
            separately; dated reports override repeating weekly availability.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="form-grid">
          <label className="field">
            Starting date
            <input
              type="date"
              required
              value={start}
              onChange={(e) => e.target.value && setStart(e.target.value)}
            />
          </label>
          <label className="field">
            View
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>Week</option>
              <option value={31}>31 days</option>
              <option value={62}>Two months</option>
            </select>
          </label>
          <button disabled={busy} onClick={load}>
            Refresh
          </button>
        </div>
        <div className="table-wrap">
          <table className="availability-chart">
            <thead>
              <tr>
                <th>Individual</th>
                <th>Available hours</th>
                {dates.map((d) => (
                  <th key={d}>{d.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const effective = dates.map(date => {
                  const report = availabilityFor(records, p.id, date);
                  if (report.status !== "unknown" || !p.weeklyHours) return {...report, personId:p.id, date};
                  const hours = availableHoursOn(p, date);
                  return {personId:p.id, date, hours, status:hours > 0 ? "available" : "unavailable"};
                });
                const summary = availabilitySummary(effective, p.id, dates);
                return (
                  <tr key={p.id}>
                    <th>{p.name}</th>
                    <td>
                      {summary.hours} h<br />
                      <small>{summary.unknown} unknown days</small>
                    </td>
                    {dates.map((d) => {
                      const r = availabilityFor(effective, p.id, d),
                        booked = manufacturingBookedDay(
                          p,
                          d,
                          workforce.bookings,
                          orders,
                        );
                      return (
                        <td
                          key={d}
                          className={"availability-" + r.status}
                          title={
                            r.status +
                            " · " +
                            booked.toFixed(1) +
                            " booked hours"
                          }
                        >
                          {r.status === "available"
                            ? r.hours + " h"
                            : r.status === "unavailable"
                              ? "Off"
                              : "?"}
                          {booked > 0 && (
                            <small>{booked.toFixed(1)} h booked</small>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h3>Record reported availability</h3>
        <p>
          Manager or Job Coach entry on behalf of the individual. Saving
          replaces the selected weekdays in this date range.
        </p>
        <form onSubmit={save}>
          <fieldset disabled={busy} className="workspace-controls">
            <div className="form-grid">
              <label className="field">
                Individual
                <select
                  required
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                From
                <input
                  type="date"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="field">
                Through
                <input
                  type="date"
                  required
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className="field">
                Availability
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="unknown">Unknown / clear report</option>
                </select>
              </label>
              {status === "available" && (
                <label className="field">
                  Hours per day
                  <input
                    type="number"
                    required
                    min="0"
                    max="24"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="weekday-choices">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={weekdays.includes(i)}
                    onChange={(e) =>
                      setWeekdays((v) =>
                        e.target.checked ? [...v, i] : v.filter((n) => n !== i),
                      )
                    }
                  />
                  {d}
                </label>
              ))}
            </div>
            <button className="primary" disabled={!person || !weekdays.length}>
              Save availability
            </button>
          </fieldset>
        </form>
      </section>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
