import { FormField } from "../../components/common/FormField.js";
import { manufacturingCanEditOrderRequest, manufacturingOrderPlan } from "../../domain/orders.js";
import { validateWorkOrder } from "../../domain/validation.js";
import { manufacturingNextOrderState } from "../../domain/workflow.js";
import { manufacturingBuildWorkOrder } from "../../domain/workOrders.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate } from "../../utils/dates.js";
import { createId } from "../../utils/ids.js";
import { React } from "../../vendor/react-runtime.js";

export function QuickApproveWorkOrder({ order }) {
  const { change, orderDisplayTitle, open, storageError } = useManufacturing();
  const dialog = React.useRef(null);
  const submitting = React.useRef(false);
  const headingId = React.useId();
  const [shown, setShown] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (shown) dialog.current?.showModal();
  }, [shown]);

  const { quantity, perPack, seconds, hoursPerDay } = manufacturingOrderPlan(order);

  async function approve(event) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = new FormData(event.currentTarget);
    const { work } = manufacturingBuildWorkOrder(order, {
      id: createId("WO"),
      type: fields.get("type"),
      scanCooldownSeconds: Number(fields.get("scanCooldownSeconds") ?? 120),
      description: order.title.trim(),
      instructions: String(fields.get("instructions") ?? "").trim(),
    });
    const problem = validateWorkOrder(work);
    if (problem) {
      setError(problem);
      return;
    }
    submitting.current = true;
    setError("");
    const saved = await change(order.id, current => {
      if (current._revision !== order._revision || !manufacturingCanEditOrderRequest(current)) {
        throw new Error("This request has changed. Reopen it to review the latest details.");
      }
      return manufacturingNextOrderState({
        ...current, expected: work.expected, workOrders: [work],
      });
    }, "Work order created and approved.");
    submitting.current = false;
    if (saved) {
      open(order.id);
    } else {
      setError("Could not approve this request. Check the workspace message and try again.");
    }
  }

  return <>
    <button type="button" className="quick-approve-button" aria-haspopup="dialog" onClick={() => {
      setError("");
      setShown(true);
    }}>Approve Work Order</button>
    {shown && <dialog ref={dialog} className="job-action-dialog" aria-labelledby={headingId}
      onClose={() => setShown(false)}
      onCancel={event => { if (submitting.current) event.preventDefault(); }}>
      <form className="job-action-body quick-approve-form" onSubmit={approve}>
        <h3 id={headingId}>Approve Work Order</h3>
        <strong>{orderDisplayTitle(order)}</strong>
        <p className="quiet">{quantity.toLocaleString()} pieces · {perPack} per pack · Due {formatDate(order.required)}</p>
        <FormField label="Job type">
          <select name="type" required defaultValue="">
            <option value="" disabled>Select job type</option>
            <option>Assembly</option>
            <option>Packaging</option>
          </select>
        </FormField>
        <FormField label="Seconds between production scans (1× load)">
          <input name="scanCooldownSeconds" type="number" min="0" max="604800" step="1" required defaultValue={120} />
        </FormField>
        <FormField label="Work instructions">
          <textarea name="instructions" required rows={3} placeholder="What should the team do?" />
        </FormField>
        <p className="quiet">Uses {seconds} sec per piece, 20 sec to pack, and a {hoursPerDay}-hour workday. Sub-jobs are generated automatically.</p>
        {error && <p className="alert" role="alert">{storageError || error}</p>}
        <div className="quick-approve-actions">
          <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="submit" className="primary">Create & approve</button>
        </div>
      </form>
    </dialog>}
  </>;
}
