import {JobCompletion} from "../../components/common/JobCompletion.js";
// features/job-board/JobActionsDialog.js
import { manufacturingTransitionLabel, manufacturingWorkflowBlock } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingBoardActions({
  order,
  onClose,
  onAdvance
}) {
  const h = React.createElement,
    dialog = React.useRef(null),
    {
      open,
      workforce
    } = useManufacturing(),
    blocked = manufacturingWorkflowBlock(order, workforce);
  React.useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return h('dialog', {
    ref: dialog,
    className: 'job-action-dialog',
    onCancel: event => {
      event.preventDefault();
      onClose();
    },
    onClick: event => {
      if (event.target === event.currentTarget) onClose();
    },
    'aria-labelledby': 'job-action-title'
  }, h('div', {
    className: 'job-action-body'
  }, h('div', {
    className: 'section-heading'
  }, h('div', null, h('small', null, 'System ID: ' + order.id), h('h3', {
    id: 'job-action-title'
  }, order.title), h('p', {
    className: 'quiet'
  }, order.customer)), h('button', {
    type: 'button',
    onClick: onClose,
    'aria-label': 'Close order actions'
  }, '×')), h(JobCompletion,{order}), h('p', {
    className: 'callout'
  }, blocked || 'Ready for ' + manufacturingTransitionLabel(order) + '.'), h('div', {
    className: 'job-action-choices'
  }, h('button', {
    type: 'button',
    onClick: () => {
      onClose();
      open(order.id);
    }
  }, 'Open order details'), order.stage < 6 && !blocked && h('button', {
    type: 'button',
    className: 'primary',
    onClick: () => {
      onAdvance(order);
      onClose();
    }
  }, manufacturingTransitionLabel(order))), h('div', {
    className: 'job-action-details'
  }, order.workOrders.map(work => h('section', {
    key: work.id
  }, h('h4', null, work.description), h('p', null, work.id + ' · ' + work.type + ' · ' + work.quantity.toLocaleString() + ' pieces · ' + work.perPack + ' per pack'), h('p', null, 'Job Coach: ' + (work.coachName || 'Awaiting assignment')), h('p', null, 'Quality checks: ' + (work.audits || []).length + ' · Packing checks: ' + (work.packing || []).length), h('ul', null, (work.jobs || []).map(job => h('li', {
    key: job.id
  }, job.name + ': ' + job.completed.toLocaleString() + ' / ' + job.quantity.toLocaleString() + ' pieces'))))), h('p', {
    className: 'quiet'
  }, 'Warehouse: ' + (order.warehouse?.receivedAt ? 'Received' : 'Pending') + ' · Delivery: ' + (order.delivery?.signedAt ? 'Customer signed' : order.delivery?.dispatchedAt ? 'Dispatched' : 'Pending')), order.history?.length > 0 && h('p', {
    className: 'quiet'
  }, 'Latest: ' + order.history.at(-1).message))));
}

export { ManufacturingBoardActions };
