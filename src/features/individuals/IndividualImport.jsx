import { React } from "../../vendor/react-runtime.js";

const nameKey = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
const asText = (value) => value == null ? "" : String(value).trim();

export function prepareIndividualRows(sheet, people) {
  const [header, ...body] = sheet;
  const headers = (header || []).map(value => asText(value).toLowerCase());
  const name = headers.indexOf("name");
  const role = headers.indexOf("role");
  const hours = headers.indexOf("hours per day");
  if (name < 0) throw new Error("The first row must contain a Name column.");
  if (body.length > 500) throw new Error("Import up to 500 rows at a time.");
  const seen = new Set();
  return body.flatMap((cells, index) => {
    if (cells.every(value => asText(value) === "")) return [];
    const displayName = asText(cells[name]).replace(/\s+/g, " ");
    const skill = asText(cells[role]);
    const rawHours = asText(cells[hours]);
    const hoursPerDay = rawHours ? Number(rawHours) : null;
    const key = nameKey(displayName);
    const matches = people.filter(p => p.kind === "individual" && nameKey(p.name) === key);
    const repeated = seen.has(key);
    seen.add(key);
    const error = !displayName || displayName.length > 160 ? "Enter a name of up to 160 characters."
      : skill.length > 240 ? "Role exceeds 240 characters."
      : rawHours && (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0 || hoursPerDay > 24) ? "Hours per day must be greater than 0 and at most 24."
      : "";
    return [{ row: index + 2, name: displayName, role: skill || null, hoursPerDay, matches, repeated, error, decision: error || repeated ? "skip" : matches.length ? "" : "add" }];
  });
}

export function IndividualImport({ people, onImport, onClose }) {
  const [rows, setRows] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const unresolved = rows.some(row => !row.decision);
  const changes = rows.filter(row => row.decision && row.decision !== "skip");

  async function load(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRows([]);
    setBusy(true);
    setError("");
    try {
      if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024)
        throw new Error("Choose an .xlsx workbook under 5 MB.");
      const { readSheet } = await import("read-excel-file/browser");
      const next = prepareIndividualRows(await readSheet(file), people);
      if (!next.length) throw new Error("The first worksheet has no individuals to import.");
      setRows(next);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (unresolved || !changes.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const problem = await onImport(changes.map(row => ({
        name: row.name, role: row.role, hoursPerDay: row.hoursPerDay,
        existingId: row.decision === "add" ? null : row.decision,
      })));
      if (problem) setError(problem);
      else onClose();
    } finally {
      setBusy(false);
    }
  }

  return <form className="panel" onSubmit={submit}>
    <h3>Import individuals from Excel</h3>
    <p>Use the first worksheet with columns <strong>Name</strong>, <strong>Role</strong> and <strong>Hours per day</strong>. Name is required. New individuals default to 6 hours per day.</p>
    <label className="field">Excel workbook
      <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={load} />
    </label>
    {rows.length > 0 && <div className="table-wrap"><table>
      <thead><tr><th>Excel row</th><th>Name</th><th>Role</th><th>Hours/day</th><th>Import decision</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.row}>
        <td>{row.row}</td><td>{row.name}</td><td>{row.role || "—"}</td><td>{row.hoursPerDay ?? "—"}</td>
        <td>{row.error || (row.repeated ? "Repeated in workbook · skipped" : row.matches.length ?
          <select aria-label={"Decision for row " + row.row + ", " + row.name} disabled={busy} value={row.decision}
            onChange={e => setRows(current => current.map(item => item.row === row.row ? {...item, decision:e.target.value} : item))}>
            <option value="">Confirm matching individual</option>
            <option value="skip">Keep existing · skip row</option>
            {row.matches.map(p => <option key={p.id} value={p.id}>Update {p.name}{p.active === false ? " (disabled)" : ""}{row.matches.length > 1 ? " · " + p.id : ""}</option>)}
          </select> : "Add individual")}</td>
      </tr>)}</tbody>
    </table></div>}
    {error && <p role="alert" className="alert">{error}</p>}
    <div className="form-actions">
      <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      <button className="primary" disabled={busy || unresolved || !changes.length}>Import {changes.length || ""} individuals</button>
    </div>
  </form>;
}
