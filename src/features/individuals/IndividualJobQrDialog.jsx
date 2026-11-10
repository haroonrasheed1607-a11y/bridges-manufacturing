import { manufacturingApi } from "../../api/supabaseClient.js";
import { manufacturingQrMatrix } from "../../domain/boxLabels.js";
import { printBrowser } from "../../services/printing/browserPrinter.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBoxQr } from "../work-orders/BoxQr.js";

export function IndividualJobQrDialog({ person, onClose }) {
  const dialog = React.useRef(null);
  const heading = React.useId();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let closed = false;
    dialog.current?.showModal();
    manufacturingApi.rpc("app_issue_individual_job_qr", { p_person: person.id })
      .then(value => { if (!closed) setCode(value); })
      .catch(problem => { if (!closed) setError(problem.message); });
    return () => { closed = true; };
  }, [person.id]);

  return <dialog ref={dialog} className="job-action-dialog" aria-labelledby={heading} onClose={onClose}>
    <div className="job-action-body">
      <h3 id={heading}>Individual Job QR</h3>
      <p><strong>{person.name}</strong></p>
      <p className="quiet">Keep this QR. It follows the individual’s approved plan for the work date.</p>
      {error && <p role="alert" className="alert">{error}</p>}
      {code ? <><ManufacturingBoxQr value={code} label="Individual Job QR" /><p><code>{code}</code></p></> :
        !error && <p role="status">Loading QR…</p>}
      <div className="form-actions">
        <button type="button" onClick={() => dialog.current?.close()}>Close</button>
        <button type="button" className="primary" disabled={!code} onClick={() => {
          setError(printBrowser([{ matrix: manufacturingQrMatrix(code), person: person.name,
            orderTitle: "Individual Job QR", boxId: code }]));
        }}>Print QR</button>
      </div>
    </div>
  </dialog>;
}
