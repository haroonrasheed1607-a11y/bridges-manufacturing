import { useManufacturing } from '../../state/ManufacturingContext.jsx';
import { JobCompletion } from '../../components/common/JobCompletion.js';
import { formatDate } from '../../utils/dates.js';
import { canUsePlan } from '../auth/permissions.js';

export function DailyOrderDetails() {
  const { order, orderDisplayTitle, setView, profile } = useManufacturing();
  if (!order) return <p className="quiet">Select an order from Plan.</p>;
  const billable = order.totalBillableUnits != null;
  return <section className="panel daily-order-details">
    <div className="section-heading"><h2>{orderDisplayTitle(order)}</h2>
      <div className="form-actions">{canUsePlan(profile?.role) && <button onClick={() => setView('plan')}>Open Plan</button>}<button onClick={() => setView('productionline')}>Open Shop Floor</button></div>
    </div>
    <dl className="order-summary-facts">
      {[["Client", order.customer], ["System ID", order.id], ["Due", formatDate(order.required)],
        [billable ? 'Total Billable Units' : 'Legacy pieces', billable ? order.totalBillableUnits : order.quantity],
        [billable ? 'BU/Scan' : 'Pieces/scan', order.workOrders.map(w => billable ? w.billableUnitsPerScan : w.scanPieces || w.perPack).join(', ')]
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}
    </dl>
    <JobCompletion order={order} />
    <div className="table-wrap"><table><thead><tr><th>Work</th><th>Total</th><th>Completed</th></tr></thead><tbody>
      {order.workOrders.flatMap(work => work.jobs.map(job => <tr key={job.id}>
        <td>{job.name || work.description || job.id}</td><td>{billable ? job.totalBillableUnits : job.quantity}</td><td>{billable ? job.billableUnitsCompleted || 0 : job.completed || 0}</td>
      </tr>))}
    </tbody></table></div>
  </section>;
}
