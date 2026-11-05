import { React } from "../../vendor/react-runtime.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingToday } from "../../utils/dates.js";
function AttendanceRow({ person, record, onSave, busy }) {
  const [value, setValue] = React.useState(
    record || { status: "", arrival: "", departure: "", workHours: "" },
  );
  React.useEffect(
    () =>
      setValue(
        record || { status: "", arrival: "", departure: "", workHours: "" },
      ),
    [record],
  );
  function change(key, v) {
    setValue((old) => ({
      ...old,
      [key]: v,
      ...(key === "status" && v !== "present"
        ? { arrival: "", departure: "", workHours: "" }
        : {}),
    }));
  }
  return (
    <tr>
      <th>{person.name}</th>
      <td>
        <select
          aria-label={"Attendance for " + person.name}
          value={value.status}
          disabled={busy}
          onChange={(e) => change("status", e.target.value)}
        >
          <option value="">Not marked</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="excused">Excused</option>
        </select>
      </td>
      {["arrival", "departure"].map((key) => (
        <td key={key}>
          <input
            aria-label={key + " for " + person.name}
            type="time"
            disabled={busy || value.status !== "present"}
            value={value[key] || ""}
            onChange={(e) => change(key, e.target.value)}
          />
        </td>
      ))}
      <td>
        <input
          aria-label={"Work hours for " + person.name}
          type="number"
          min="0"
          max="24"
          step="0.25"
          disabled={busy || value.status !== "present"}
          value={value.workHours ?? ""}
          onChange={(e) => change("workHours", e.target.value)}
        />
      </td>
      <td>
        <button
          disabled={busy || !value.status}
          onClick={() =>
            onSave(person.id, { ...value, revision: record?.revision || 0 })
          }
        >
          Save
        </button>
      </td>
    </tr>
  );
}
export function AttendancePage() {
  const { workforce } = useManufacturing(),
    people = workforce.people.filter((p) => p.kind === "individual");
  const [date, setDate] = React.useState(manufacturingToday),
    [records, setRecords] = React.useState([]),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [message, setMessage] = React.useState("");
  const generation = React.useRef(0);
  async function load() {
    const n = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const r = await manufacturingApi.rpc("app_attendance", { p_date: date });
      if (n === generation.current) setRecords(r);
    } catch (e) {
      if (n === generation.current) setError(e.message);
    } finally {
      if (n === generation.current) setBusy(false);
    }
  }
  React.useEffect(() => {
    setRecords([]);
    setMessage("");
    load();
    return () => {
      generation.current++;
    };
  }, [date]);
  async function save(id, v) {
    setBusy(true);
    setError("");
    try {
      const r = await manufacturingApi.rpc("app_attendance", {
        p_date: date,
        p_person: id,
        p_status: v.status,
        p_arrival: v.arrival || null,
        p_departure: v.departure || null,
        p_work_hours:
          v.workHours === "" || v.workHours == null
            ? null
            : Number(v.workHours),
        p_revision: v.revision,
      });
      setRecords(r);
      setMessage("Attendance saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const present = records.filter((r) => r.status === "present").length;
  return (
    <div>
      <div className="page-heading">
        <div>
          <h2>Daily attendance roster</h2>
          <p>
            {present} present ·{" "}
            {records.filter((r) => r.status === "absent").length} absent ·{" "}
            {Math.max(0, people.length - records.length)} not marked
          </p>
        </div>
      </div>
      <section className="panel">
        <label className="field">
          Date
          <input
            type="date"
            disabled={busy}
            required
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <button disabled={busy} onClick={load}>
          Refresh roster
        </button>
        <p>
          Record actual attendance. Work hours are entered separately; time
          between arrival and departure includes breaks. Saved attendance
          appears on weekly timesheets.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Individual</th>
                <th>Status</th>
                <th>Arrival</th>
                <th>Departure</th>
                <th>Work hours</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <AttendanceRow
                  key={date + p.id}
                  person={p}
                  record={records.find((r) => r.personId === p.id)}
                  onSave={save}
                  busy={busy}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
