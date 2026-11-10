import { CurrentWorkPanel } from "./CurrentWorkPanel.jsx";
import { useCurrentWork } from "./useCurrentWork.js";
import { BulkBoxSetup } from "./BulkBoxSetup.jsx";
import { React } from "../../vendor/react-runtime.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { useScreenMemory } from "../../state/useScreenMemory.js";
import { manufacturingIsCoach } from "../../domain/workforce.js";
import {
  manufacturingPrintBox,
  manufacturingPreviewLabels,
} from "../../domain/boxLabels.js";
import { manufacturingToday } from "../../utils/dates.js";
import { createId } from "../../utils/ids.js";
import { nextBoxJob, remainingBoxPieces } from "./boxSetupModel.js";
export function SimpleBoxSetup({ includeBulk = true } = {}) {
  const { orders, workforce, orderDisplayTitle, createProductionBox } = useManufacturing();
  const [workId, setWorkId] = useScreenMemory("simple-box-job", "");
  const [personId, setPersonId] = React.useState("");
  const [jobSearch, setJobSearch] = React.useState(""),
    [personSearch, setPersonSearch] = React.useState("");
  const [label, setLabel] = React.useState(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  const jobs = orders
    .filter((o) => o.stage === 1)
    .flatMap((order) =>
      order.workOrders
        .filter((work) => nextBoxJob(work))
        .map((work) => ({ order, work })),
    );
  const selected = jobs.find((x) => x.work.id === workId) || jobs[0];
  const people = workforce.people.filter(
    (p) => !manufacturingIsCoach(p) && p.active !== false,
  );
  const visibleJobs = jobs.filter(
    (x) =>
      x.work.id === selected?.work.id ||
      [orderDisplayTitle(x.order), x.work.description, x.work.id]
        .join(" ")
        .toLowerCase()
        .includes(jobSearch.toLowerCase()),
  );
  const visiblePeople = people.filter(
    (p) =>
      p.id === personId ||
      p.name.toLowerCase().includes(personSearch.toLowerCase()),
  );
  const job = selected && nextBoxJob(selected.work);
  const current = useCurrentWork(personId, orders);
  const quantity = job
    ? Math.min(
        Number(selected.work.perPack),
        remainingBoxPieces(selected.work, job),
      )
    : 0;
  async function create(event) {
    event.preventDefault();
    if (
      lock.current ||
      !selected ||
      !job ||
      !personId ||
      quantity < 1 ||
      current.busy ||
      current.checking
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    setLabel(null);
    try {
      const box = {
        id: createId("BOX"),
        jobId: job.id,
        personId,
        quantity,
        date: manufacturingToday(),
        coachId: selected.work.coachId || null,
      };
      const problem = await createProductionBox(
        selected.order.id,
        selected.work.id,
        box,
      );
      if (problem) {
        setError(problem);
        current.reload();
        return;
      }
      setLabel({
        ...selected,
        job,
        box,
        person: people.find((p) => p.id === personId),
      });
      setError(
        manufacturingPrintBox(
          selected.order,
          selected.work,
          job,
          box,
          people.find((p) => p.id === personId),
        ),
      );
    } catch {
      setError(
        "Unable to prepare the label. If the box was saved, reprint its label instead of creating another.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel simple-box-setup">
        <h2>New box label</h2>
        <div className="single-box-columns">
          <div>
            <form onSubmit={create}>
              <label className="field">
                <span>1 · Select a job</span>
                <input
                  type="search"
                  aria-label="Search available jobs"
                  placeholder="Search job or work order…"
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                />
                <select
                  size={4}
                  className="setup-choice-list"
                  aria-label="Available jobs"
                  value={selected?.work.id || ""}
                  onChange={(e) => {
                    setWorkId(e.target.value);
                    setLabel(null);
                    setError("");
                  }}
                  disabled={!jobs.length}
                >
                  {!jobs.length && <option value="">No jobs available</option>}
                  {visibleJobs.map(({ order, work }) => (
                    <option key={work.id} value={work.id}>
                      {orderDisplayTitle(order)} · {work.description || work.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>2 · Select an individual</span>
                <input
                  type="search"
                  aria-label="Search individuals"
                  placeholder="Search individual name…"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                />
                <select
                  required
                  size={6}
                  className="setup-choice-list"
                  aria-label="Individual"
                  value={personId}
                  onChange={(e) => {
                    setPersonId(e.target.value);
                    setLabel(null);
                  }}
                >
                  <option value="">Select individual</option>
                  {visiblePeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {job && (
                <p className="setup-job-summary" aria-live="polite">
                  {job.name} · {quantity} pieces per box
                </p>
              )}
              <button
                className="primary"
                disabled={
                  busy ||
                  current.busy ||
                  current.checking ||
                  !job ||
                  !personId ||
                  quantity < 1
                }
              >
                {busy
                  ? "Creating…"
                  : current.checking
                    ? "Checking individual…"
                    : current.busy
                      ? "Individual already has work"
                      : "Create & print box"}
              </button>
            </form>
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            {label && (
              <div className="box-label-ready" role="status">
                <p>Box ready · {label.box.id}</p>
                <button
                  onClick={() => setError(manufacturingPreviewLabels([label]))}
                >
                  Preview label
                </button>
                <button
                  className="primary"
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
                  Reprint label
                </button>
              </div>
            )}
          </div>
          <CurrentWorkPanel
            person={people.find((p) => p.id === personId)}
            current={current}
            displayTitle={item => orderDisplayTitle(orders.find(order => order.id === item.orderId) ?? { title: item.orderTitle })}
            onError={setError}
          />
        </div>
      </section>
      {includeBulk && <BulkBoxSetup />}
    </>
  );
}
