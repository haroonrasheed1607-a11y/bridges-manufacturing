// features/work-orders/WorkOrdersPage.js
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingCanEditWorkOrder } from "../../domain/workOrders.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingProductionBoxes } from "../production/BoxAssignment.js";
import { ManufacturingPrintSection } from "./PrintSection.js";
import { WorkOrderForm } from "./WorkOrderForm.js";
import { ManufacturingWorkPaper } from "./WorkPaper.js";

function WorkOrdersPage() {
  const {
      order, manager,
      change,
      updateWork,
      setView
    } = useManufacturing(),
    h = React.createElement,
    [adding, setAdding] = React.useState(null),
    [editing, setEditing] = React.useState(null);

  const editingWork = editing && order.workOrders.find(work => work.id === editing.id);
  React.useEffect(() => {
    if (editing && (!editingWork || !manufacturingCanEditWorkOrder(order, editingWork))) setEditing(null);
  }, [editing, editingWork, order.stage]);

  async function saveEdit(work) {
    const saved = await change(order.id, current => {
      const existing = current.workOrders.find(item => item.id === work.id);
      if (!existing || !manufacturingCanEditWorkOrder(current, existing)) {
        throw new Error('This work order is locked because production progress has been recorded.');
      }
      if (current._revision !== editing.revision) {
        throw new Error('This order changed while you were editing. Reopen the work order and try again.');
      }
      const workOrders = current.workOrders.map(item => item.id === work.id ? work : item);
      const expected = workOrders.map(item => item.expected).filter(Boolean).sort().at(-1);
      return { ...current, workOrders, expected };
    }, 'Work order updated.');
    if (saved) setEditing(null);
  }
  return h(React.Fragment, null, h('div', {
    className: 'section-heading'
  }, h('div', null, h('h3', null, 'Work orders & sub-jobs'), h('p', {
    className: 'quiet'
  }, 'Prepare printable job sheets and track production.')), h('div', {
    className: 'paper-editor-buttons'
  }, manager && order.stage < 2 && order.workOrders.length > 0 && h('button', {
    onClick: () => setView('individuals')
  }, 'Book individuals'), manager && order.stage === 0 && !order.workOrderApprovedAt && !adding && !editing && h('button', {
    onClick: () => setAdding({ revision: order._revision })
  }, '＋ Add work order'))), order.stage === 1 && h(ManufacturingProductionBoxes, {
    orderKey: order.id
  }), adding && h(WorkOrderForm, {
    order,
    onCancel: () => setAdding(null),
    onSave: async work => {
      const saved = await change(order.id, current => {
        if (current.stage !== 0 || current.workOrderApprovedAt || current._revision !== adding.revision) {
          throw new Error('This order changed while you were preparing the work order. Reopen the form and try again.');
        }
        const workOrders = [...current.workOrders, work];
        const expected = workOrders.map(item => item.expected).filter(Boolean).sort().at(-1);
        return { ...current, workOrders, expected };
      }, 'Work order added.');
      if (saved) setAdding(null);
    }
  }), !order.workOrders.length && !adding && h('p', {
    className: 'empty'
  }, 'No work orders yet. Add a work order to prepare the job sheet.'), order.workOrders.map(work => {
    const canEdit = manager && manufacturingCanEditWorkOrder(order, work);
    if (editing?.id === work.id && canEdit) {
      return h('div', { key: work.id, className: 'saved-work-paper' }, h(WorkOrderForm, {
        order, existingWork: work, onSave: saveEdit, onCancel: () => setEditing(null)
      }));
    }
    return h('div', {
      key: work.id,
      className: 'saved-work-paper'
    }, canEdit && h('button', {
      type: 'button',
      disabled: adding || !!editing,
      onClick: () => setEditing({ id: work.id, revision: order._revision })
    }, 'Edit work order'), manager && !canEdit && h('p', {
      className: 'quiet'
    }, 'Editing locked after production progress is recorded.'), h(ManufacturingWorkPaper, {
    order,
    work,
    progressControls: job => manager && order.stage === 1 ? h('form', {
      className: 'paper-progress-form',
      onSubmit: event => {
        event.preventDefault();
        const completed = Number(new FormData(event.currentTarget).get('completed'));
        if (Number.isSafeInteger(completed) && completed >= 0 && completed <= job.quantity) updateWork(work.id, current => ({
          ...current,
          jobs: current.jobs.map(item => item.id === job.id ? {
            ...item,
            completed
          } : item)
        }), job.name + ': ' + completed + ' pieces completed.');
      }
    }, h('label', null, 'Completed pieces', h('input', {
      key: job.completed,
      name: 'completed',
      type: 'number',
      min: 0,
      max: job.quantity,
      required: true,
      defaultValue: job.completed
    })), h('button', null, 'Save')) : h('p', {
      className: 'paper-job-complete'
    }, 'Completed: ' + job.completed + ' / ' + job.quantity)
  }), h(ManufacturingPrintSection, {
    order,
    work
  }));
  }));
}

export { WorkOrdersPage };
