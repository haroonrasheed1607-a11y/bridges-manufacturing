// features/work-orders/PaperHeader.js
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBarcode } from "./Barcode.js";

function ManufacturingPaperHeader({
  order,
  work
}) {
  const h = React.createElement;
  return h('header', {
    className: 'paper-job-header'
  }, h('div', {
    className: 'paper-title'
  }, h('small', null, 'BRIDGES / MANUFACTURING'), h('h3', null, 'WORK ORDER'), h('span', null, order.id)), h(ManufacturingBarcode, {
    value: work.id
  }), h('img', {
    className: 'paper-mono-logo',
    src: manufacturingWorkLogo,
    alt: 'Bridges logo'
  }));
}

export { ManufacturingPaperHeader };
