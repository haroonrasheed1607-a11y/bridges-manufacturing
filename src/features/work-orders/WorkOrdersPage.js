// features/work-orders/WorkOrdersPage.js
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
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
    [adding, setAdding] = React.useState(false);
  return h(React.Fragment, null, h('div', {
    className: 'section-heading'
  }, h('div', null, h('h3', null, 'Work orders & sub-jobs'), h('p', {
    className: 'quiet'
  }, 'Prepare printable job sheets and track production.')), h('div', {
    className: 'paper-editor-buttons'
  }, manager && order.stage < 2 && order.workOrders.length > 0 && h('button', {
    onClick: () => setView('individuals')
  }, 'Book individuals'), manager && order.stage === 0 && !order.workOrderApprovedAt && !adding && h('button', {
    onClick: () => setAdding(true)
  }, '＋ Add work order'))), order.stage === 1 && h(ManufacturingProductionBoxes, {
    orderKey: order.id
  }), adding && h(WorkOrderForm, {
    order,
    onCancel: () => setAdding(false),
    onSave: async work => {
      const saved = await change(order.id, current => ({
        ...current,
        workOrders: [...current.workOrders, work],
        expected: [...current.workOrders.map(item => item.expected), work.expected].filter(Boolean).sort().at(-1)
      }), 'Work order added.');
      if (saved) setAdding(false);
    }
  }), !order.workOrders.length && !adding && h('p', {
    className: 'empty'
  }, 'No work orders yet. Add a work order to prepare the job sheet.'), order.workOrders.map(work => h('div', {
    key: work.id,
    className: 'saved-work-paper'
  }, h(ManufacturingWorkPaper, {
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
  }))));
}

export { WorkOrdersPage };
