import { React } from '../../vendor/react-runtime.js';
import { useManufacturing } from '../../state/ManufacturingContext.jsx';
import { useScreenMemory } from '../../state/useScreenMemory.js';

export function OptionalWorkflows() {
  const { profile, orders, setView, open, orderDisplayTitle } = useManufacturing();
  const [selected, select] = React.useState('');
  if (profile?.role !== 'admin') return null;
  return <section className="panel optional-workflows">
    <h3>Optional workflows</h3>
    <p className="quiet">These tools are kept here for occasional use. Daily work continues through Plan and Shop Floor.</p>
    <div className="optional-tool-list">
      {[
        ['Job Board', 'board', 'The full order-stage board, approvals and transitions.'],
        ['Order register', 'orders', 'All orders and manual order requests.'],
        ['Manual order request', 'new', 'Detailed quantities, deadlines, pictures and repeat orders.'],
        ['Capacity & bookings', 'optionalpeople', 'Individual workload calendars and manual work bookings.'],
        ['Availability chart', 'availability', 'Date-specific availability overrides.'],
        ['Box-label setup', 'optionalboxes', 'Single-use boxes, bulk labels and standalone reusable labels.'],
        ['Approved-plan printing', 'shopfloorprint', 'Print labels for approved plans.'],
        ['Workflow guide', 'workflow', 'Quality, packing, warehouse and delivery stages.'],
      ].map(([label, route, description]) => <div key={route}>
        <div><strong>{label}</strong><small>{description}</small></div>
        <button type="button" onClick={() => setView(route)}>Open</button>
      </div>)}
    </div>
    <h4>Detailed order workflow</h4>
    <p className="quiet">Work-order editing, sub-jobs, quality, packing, warehouse, delivery and challans remain available for the selected order at its current stage.</p>
    <div className="form-actions">
      <label className="field">Order<select value={selected} onChange={e => select(e.target.value)}>
        <option value="">Select an order</option>{orders.map(order => <option key={order.id} value={order.id}>{orderDisplayTitle(order)}</option>)}
      </select></label>
      <button type="button" disabled={!selected} onClick={() => { open(selected); setView('optionalorder'); }}>Open detailed workflow</button>
    </div>
  </section>;
}

export function OptionalWorkflowShell({ children }) {
  const { setView, profile } = useManufacturing();
  const [, setTab] = useScreenMemory('configurations-tab', 'settings');
  function back() { setTab('optional'); setView('configurations'); }
  return <>
    <div className="optional-workflow-banner"><span>Configurations / Optional workflows</span><button type="button" onClick={back}>Back to optional workflows</button></div>
    {profile?.role === 'admin' ? children : <section className="panel"><p>Optional workflows are managed by an administrator. Use Plan or Shop Floor for daily work.</p><button type="button" onClick={() => setView('productionline')}>Open Shop Floor</button></section>}
  </>;
}
