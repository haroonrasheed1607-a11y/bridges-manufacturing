// features/work-orders/PrintSection.js
import { manufacturingPaperPrintCss } from "../../styles/workOrderPrint.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingWorkPaper } from "./WorkPaper.js";

function ManufacturingPrintSection({
  order,
  work
}) {
  const h = React.createElement,
    [instructions, setInstructions] = React.useState(true),
    [subJobs, setSubJobs] = React.useState(true),
    [preview, setPreview] = React.useState(false),
    [error, setError] = React.useState(''),
    ref = React.useRef(null);
  function print() {
    setError('');
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Allow the print window to open, then try again.');
      return;
    }
    popup.document.open();
    popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Work order ' + work.id + '</title><style>' + manufacturingPaperPrintCss + '</style></head><body>' + ref.current.innerHTML + '</body></html>');
    popup.document.close();
    Promise.all(Array.from(popup.document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    }))).then(() => {
      popup.focus();
      popup.print();
    });
  }
  return h('section', {
    className: 'work-print-section'
  }, h('h4', null, 'Print'), h('p', {
    className: 'quiet'
  }, 'Print this work order or save it as PDF from your browser’s print dialog.'), h('div', {
    className: 'work-print-options'
  }, h('label', null, h('input', {
    type: 'checkbox',
    checked: instructions,
    onChange: event => setInstructions(event.target.checked)
  }), ' Include instructions'), h('label', null, h('input', {
    type: 'checkbox',
    checked: subJobs,
    onChange: event => setSubJobs(event.target.checked)
  }), ' Include sub-jobs and barcodes')), h('div', {
    className: 'work-print-actions'
  }, h('button', {
    type: 'button',
    onClick: () => setPreview(value => !value)
  }, preview ? 'Hide print preview' : 'Preview printout'), h('button', {
    type: 'button',
    className: 'primary',
    onClick: print
  }, 'Print Work Order')), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error), h('div', {
    ref,
    className: 'work-print-preview',
    hidden: !preview
  }, h(ManufacturingWorkPaper, {
    order,
    work,
    includeInstructions: instructions,
    includeSubJobs: subJobs
  })));
}

export { ManufacturingPrintSection };
