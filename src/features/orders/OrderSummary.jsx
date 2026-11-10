import { Badge } from "../../components/common/Badge.js";
import { JobCompletion } from "../../components/common/JobCompletion.js";
import { manufacturingFrequencyLabel, manufacturingOrderPlan } from "../../domain/orders.js";
import { getOrderPackRecords } from "../../domain/validation.js";
import { manufacturingBoardStage, manufacturingBoardStages } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate } from "../../utils/dates.js";

export function OrderSummary() {
  const { order, orderDisplayTitle } = useManufacturing();
  const stage = manufacturingBoardStage(order);
  const plan = manufacturingOrderPlan(order);
  const facts = [
    ["Customer", order.customer],
    ["System ID", order.id],
    ...(order.orderNumber ? [["Order number", order.orderNumber]] : []),
    ["Required delivery", formatDate(order.required)],
    ["Forecast", order.expected ? formatDate(order.expected) : "Awaiting work order"],
    ["Frequency", manufacturingFrequencyLabel(order)],
    ["Total pieces", plan.quantity.toLocaleString()],
    ["Pieces per pack", plan.perPack],
    ["Packs required", plan.packCount],
    ["Work orders", order.workOrders.length],
    ["Sub-jobs", order.workOrders.reduce((sum, work) => sum + work.jobs.length, 0)],
    ["Pack records", getOrderPackRecords(order).length],
  ];
  return <section className="panel order-summary" aria-label="Order summary">
    <header className="order-summary-heading">
      <h2>{orderDisplayTitle(order)}</h2>
      <Badge tone={order.stage === 6 ? "green" : ""}>{manufacturingBoardStages[stage]}</Badge>
    </header>
    <dl className="order-summary-facts">
      {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {order.expected && order.required && order.expected > order.required &&
      <p className="alert">Forecast is later than the required date.</p>}
    <JobCompletion order={order} />
    <ol className="stage-strip" aria-label="Order progress">
      {manufacturingBoardStages.map((label, index) => <li
        key={label}
        className={index === stage ? "current" : index < stage ? "done" : ""}
        aria-current={index === stage ? "step" : undefined}>
        <span>{index < stage ? "✓" : String(index + 1).padStart(2, "0")}</span>
        <strong>{label}</strong>
      </li>)}
    </ol>
  </section>;
}
