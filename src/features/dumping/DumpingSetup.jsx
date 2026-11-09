import { React } from "../../vendor/react-runtime.js";
import { manufacturingApi } from "../../api/supabaseClient.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { createId } from "../../utils/ids.js";
import {
  manufacturingPrintBox,
  manufacturingPreviewLabels,
} from "../../domain/boxLabels.js";
import { dumpingLabel } from "./model.js";
export function DumpingSetup() {
  const { orders, workforce } = useManufacturing();
  const [assignments, setAssignments] = React.useState([]),
    [jobId, setJobId] = React.useState(""),
    [personId, setPersonId] = React.useState(""),
    [quantity, setQuantity] = React.useState(100),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState("");
  const jobs = orders
      .filter((o) => o.stage === 1)
      .flatMap((order) =>
        order.workOrders.flatMap((work) =>
          work.jobs
            .filter((j) => j.completed < j.quantity)
            .map((job) => ({ order, work, job })),
        ),
      ),
    selected = jobs.find((x) => x.job.id === jobId) || jobs[0],
    people = workforce.people.filter(
      (p) => p.kind === "individual" && p.active !== false,
    );
  async function load() {
    setBusy(true);
    setError("");
    try {
      setAssignments(await manufacturingApi.rpc("app_dumping_list"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  React.useEffect(() => {
    load();
  }, []);
  async function assign(e) {
    e.preventDefault();
    if (!selected || !personId) return;
    setBusy(true);
    setError("");
    try {
      setAssignments(
        await manufacturingApi.rpc("app_dumping_assign", {
          p_id: createId("REUSE"),
          p_job: selected.job.id,
          p_person: personId,
          p_quantity: Number(quantity),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function close(id) {
    setBusy(true);
    try {
      setAssignments(
        await manufacturingApi.rpc("app_dumping_close", { p_id: id }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Reusable barcode</h2>
      <p>
        One reusable QR per individual and sub-job. Each accepted scan records
        another batch. Assignments do not reserve pieces; every scan checks
        remaining capacity.
      </p>
      <form onSubmit={assign}>
        <fieldset disabled={busy} className="workspace-controls">
          <div className="form-grid">
            <label className="field">
              Production sub-job
              <select
                required
                value={selected?.job.id || ""}
                onChange={(e) => setJobId(e.target.value)}
              >
                {!jobs.length && (
                  <option value="">No unfinished production jobs</option>
                )}
                {jobs.map((x) => (
                  <option key={x.job.id} value={x.job.id}>
                    {x.order.title} · {x.work.description} · {x.job.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Individual
              <select
                required
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">Select individual</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Pieces per scan
              <input
                type="number"
                required
                min="1"
                max="1000000"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
          </div>
          <button className="primary" disabled={!selected || !personId}>
            Create reusable QR
          </button>
        </fieldset>
      </form>
      <button disabled={busy} onClick={load}>
        Refresh assignments
      </button>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="dumping-assignments">
        {assignments.map((a) => {
          const label = dumpingLabel(a, orders, workforce.people);
          if (!label) return null;
          return (
            <article className="panel" key={a.id}>
              <strong>
                {label.person.name} · {a.batchQuantity} pieces per scan
              </strong>
              <p>
                {label.order.title} · {label.work.description} ·{" "}
                {label.job.name}
              </p>
              <p>
                {a.id} · {a.pieces} pieces recorded ·{" "}
                {a.active ? "Active" : "Closed"}
              </p>
              <div className="actions">
                <button
                  disabled={busy}
                  onClick={() => setError(manufacturingPreviewLabels([label]))}
                >
                  Preview
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    setError(
                      manufacturingPrintBox(
                        label.order,
                        label.work,
                        label.job,
                        label.box,
                        label.person,
                      ),
                    )
                  }
                >
                  Print reusable QR
                </button>
                {a.active && (
                  <button disabled={busy} onClick={() => close(a.id)}>
                    Close assignment
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {!assignments.length && <p>No reusable assignments yet.</p>}
      </div>
    </section>
  );
}
