import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBoxQr } from "../work-orders/BoxQr.js";
import {
  manufacturingPrintBox,
  manufacturingPreviewLabels,
} from "../../domain/boxLabels.js";
export function CurrentWorkPanel({ person, current, onError }) {
  if (!person)
    return (
      <aside className="current-work-panel">
        <h3>Current barcode</h3>
        <p>Select an individual to see their current work.</p>
      </aside>
    );
  return (
    <aside className="current-work-panel" aria-live="polite">
      <h3>{person.name} · current work</h3>
      {current.checking ? (
        <p>Checking assignments…</p>
      ) : current.error ? (
        <p role="alert">{current.error}</p>
      ) : !current.busy ? (
        <p>No unfinished work. Ready for a new barcode.</p>
      ) : (
        <>
          <p className="callout">
            Already assigned. A new barcode cannot be created.
          </p>
          {!current.items.length && (
            <p>Ask the assigned Job Coach to review the existing work.</p>
          )}
          {current.items.map((item) => {
            const label = {
              order: { id: item.orderId, title: item.orderTitle },
              work: { id: item.workId, description: item.description },
              job: {
                name:
                  (item.kind === "dumping" ? "REUSE · " : "") + item.jobName,
              },
              box: { id: item.id, quantity: item.quantity },
              person,
            };
            return (
              <div key={item.id} className="current-barcode">
                <ManufacturingBoxQr value={item.id} />
                <strong>{item.id}</strong>
                <p>
                  {item.orderTitle}
                  <br />
                  {item.description} · {item.jobName}
                  <br />
                  {item.quantity} pieces
                  {item.kind === "dumping" ? " per scan" : ""}
                </p>
                <button
                type="button"
                  onClick={() => onError(manufacturingPreviewLabels([label]))}
                >
                  Preview current label
                </button>
                <button
                type="button"
                  onClick={() =>
                    onError(
                      manufacturingPrintBox(
                        label.order,
                        label.work,
                        label.job,
                        label.box,
                        person,
                      ),
                    )
                  }
                >
                  Reprint current barcode
                </button>
              </div>
            );
          })}
        </>
      )}
    </aside>
  );
}
