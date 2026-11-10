import { useManufacturing } from "../../state/ManufacturingContext.jsx";
// features/work-orders/WorkPaper.js
import { formatDate } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingAssemblyFlow } from "./AssemblyFlow.js";
import { ManufacturingPaperHeader } from "./PaperHeader.js";
import { ManufacturingSubJobSheets } from "./SubJobSheets.js";
import { ManufacturingWorkPlanSummary } from "./WorkPlanSummary.js";

function ManufacturingWorkPaper({
  order,
  work,
  includeInstructions = true,
  includeSubJobs = true,
  progressControls
}) {
  const { orderDisplayTitle } = useManufacturing();
  const h = React.createElement,
    section = (number, title, ...children) => h('section', {
      className: 'paper-section'
    }, h('h4', {
      className: 'paper-section-title'
    }, number + ' / ' + title), ...children);
  return h('article', {
    className: 'manufacturing-paper'
  }, h(ManufacturingPaperHeader, {
    order,
    work
  }), section('01', 'JOB DETAILS', h('dl', {
    className: 'paper-job-facts'
  }, ...Object.entries({
    'Order title': orderDisplayTitle(order),
    'Customer': order.customer,
    'Job type': work.type,
    'Description': work.description,
    'Total pieces': work.quantity.toLocaleString(),
    'Required delivery': formatDate(work.required)
  }).map(([label, value]) => h('div', {
    key: label
  }, h('dt', null, label), h('dd', null, value))))), section('02', 'WORK PLAN', h('dl', {
    className: 'paper-job-facts'
  }, ...Object.entries({
    'Time per piece': work.seconds + ' sec',
    [work.timingVersion === 2 ? 'Time to pack all pieces in a package' : 'Time to pack each piece']: (work.packSeconds || 0) + ' sec',
    'Time per package': (work.packageSeconds || 0) + ' sec',
    'Production starts': formatDate(work.startDate)
  }).map(([label, value]) => h('div', {
    key: label
  }, h('dt', null, label), h('dd', null, value)))), h(ManufacturingWorkPlanSummary, {
    work
  })), includeInstructions && section('03', work.type === 'Assembly' ? 'ASSEMBLY INSTRUCTIONS' : 'INSTRUCTIONS', work.type === 'Assembly' && h(ManufacturingAssemblyFlow, {
    parts: work.parts
  }), h('p', {
    className: 'paper-instructions'
  }, work.instructions)), includeSubJobs && section('04', 'SUB-JOBS', h('p', {
    className: 'paper-section-note'
  }, (work.jobs || []).length + ' sub-jobs' + (work.packsPerSubJob ? ' · ' + work.packsPerSubJob + ' packs per sub-job. The final sub-job contains the remaining packs.' : '.')), h(ManufacturingSubJobSheets, {
    work,
    progressControls
  })));
}

export { ManufacturingWorkPaper };
