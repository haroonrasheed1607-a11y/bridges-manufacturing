// features/work-orders/SubJobSheets.js
import { manufacturingWorkDuration, manufacturingWorkSeconds } from "../../domain/workOrders.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBarcode } from "./Barcode.js";

function ManufacturingSubJobSheets({
  work,
  progressControls
}) {
  const h = React.createElement;
  return h('div', {
    className: 'paper-subjobs'
  }, (work.jobs || []).map(job => {
    const estimate = job.estimatedSeconds ?? manufacturingWorkSeconds({
      ...work,
      quantity: job.quantity
    });
    return h('section', {
      key: job.id,
      className: 'paper-subjob'
    }, h('div', {
      className: 'paper-subjob-info'
    }, h('h4', null, job.name), h('p', null, job.quantity.toLocaleString() + ' pieces · ' + Math.ceil(job.quantity / work.perPack) + ' ' + (job.packType === 'Packet' ? 'packets' : 'boxes')), h('small', null, 'Estimated labor: ' + manufacturingWorkDuration(estimate)), estimate > (job.targetSeconds ?? Number(work.hoursPerDay || 6) * 1800) && h('small', {
      className: 'paper-long-job'
    }, 'Above the suggested half-day duration.'), progressControls && progressControls(job)), h(ManufacturingBarcode, {
      value: job.id
    }));
  }));
}

export { ManufacturingSubJobSheets };
