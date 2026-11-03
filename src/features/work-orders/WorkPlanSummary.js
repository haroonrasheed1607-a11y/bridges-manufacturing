// features/work-orders/WorkPlanSummary.js
import { manufacturingWorkDuration, manufacturingWorkSeconds } from "../../domain/workOrders.js";
import { formatDate } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingMonoIcon } from "./MonoIcon.js";

function ManufacturingWorkPlanSummary({
  work
}) {
  const h = React.createElement,
    total = manufacturingWorkSeconds(work),
    packs = Math.ceil(work.quantity / work.perPack),
    people = Number(work.people || 1),
    hours = Number(work.hoursPerDay || 6),
    days = total / (people * hours * 3600),
    item = (label, value) => h('div', {
      key: label
    }, h('dt', null, label), h('dd', null, value));
  return h('div', null, h('div', {
    className: 'paper-visual-totals'
  }, h('div', null, h(ManufacturingMonoIcon, {
    kind: 'box'
  }), h('div', null, h('strong', null, packs.toLocaleString()), h('span', null, 'packs · ' + work.perPack + ' pieces per pack'))), h('div', null, h(ManufacturingMonoIcon, {
    kind: 'person'
  }), h('div', null, h('strong', null, work.recommendedPeople ?? people), h('span', null, 'people needed' + (people !== (work.recommendedPeople ?? people) ? ' · ' + people + ' assigned' : ''))))), h('dl', {
    className: 'paper-plan-totals'
  }, item('Total time needed', manufacturingWorkDuration(total)), item('Working hours', hours + ' h/person/day'), item('Time to complete the job', manufacturingWorkDuration(total / people) + ' per person · ' + Math.ceil(days * 100) / 100 + ' working days'), item('Expected completion', formatDate(work.expected))), h('p', {
    className: 'paper-formula'
  }, work.timingVersion === 2 ? 'Time per package = ' + work.seconds + ' sec × ' + work.perPack + ' pieces + ' + work.packSeconds + ' sec to pack. Total = ' + work.quantity + ' × ' + work.seconds + ' + ' + packs + ' × ' + work.packSeconds + ' sec. Monday–Friday.' : 'Total = ' + work.quantity + ' × (' + work.seconds + ' + ' + (work.packSeconds || 0) + ') sec + ' + packs + ' × ' + (work.packageSeconds || 0) + ' sec. Monday–Friday.'));
}

export { ManufacturingWorkPlanSummary };
