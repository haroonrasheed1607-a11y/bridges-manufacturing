// features/delivery/DeliveryChallan.js
import { manufacturingWorkLogo } from "../../assets/workLogo.js";
import { FormField } from "../../components/common/FormField.js";
import { manufacturingChallanRows } from "../../domain/delivery.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingChallanPrintCss } from "../../styles/challanPrint.js";
import { formatDate, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBarcode } from "../work-orders/Barcode.js";

function ManufacturingDeliveryChallan() {
  const {
      order,
      change
    } = useManufacturing(),
    h = React.createElement,
    saved = order.delivery?.challan || {},
    [date, setDate] = React.useState(saved.date || manufacturingToday()),
    [reference, setReference] = React.useState(saved.reference || ''),
    [vehicle, setVehicle] = React.useState(saved.vehicle || ''),
    [preparedBy, setPreparedBy] = React.useState(saved.preparedBy || order.delivery?.approver || ''),
    [notes, setNotes] = React.useState(saved.notes || ''),
    [copy, setCopy] = React.useState('Accounts copy'),
    [error, setError] = React.useState(''),
    paper = React.useRef(null),
    number = saved.number || 'DC-' + order.id,
    rows = manufacturingChallanRows(order),
    delivery = order.delivery || {},
    field = (label, value, set, type = 'text') => h(FormField, {
      label
    }, h('input', {
      type,
      value,
      onChange: event => set(event.target.value)
    })),
    fact = (label, value) => h('div', {
      key: label
    }, h('dt', null, label), h('dd', null, value || '________________________'));
  async function print() {
    setError('');
    if (!date) {
      setError('Choose a challan date before printing.');
      return;
    }
    const popup = window.open('', '_blank');
    if (!popup) {
      setError('Allow the print window to open, then choose Print delivery challan again.');
      return;
    }
    const saved = await change(order.id, current => ({
      ...current,
      delivery: {
        ...current.delivery,
        challan: {
          number,
          date,
          reference,
          vehicle,
          preparedBy,
          notes
        }
      }
    }), 'Delivery challan ' + number + ' prepared for printing.');
    if(!saved){popup.close();setError('Could not save the challan. Check the connection and retry.');return;}
    popup.document.open();
    popup.document.write('<!doctype html><html><head><title>Delivery Challan</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + manufacturingChallanPrintCss + '</style></head><body>' + paper.current.innerHTML + '</body></html>');
    popup.document.close();
    const images = Array.from(popup.document.images);
    Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    }))).then(() => {
      popup.focus();
      popup.print();
    });
  }
  return h('section', {
    className: 'panel delivery-challan-section'
  }, h('h3', null, 'Delivery challan'), h('p', {
    className: 'quiet'
  }, 'Print a copy for the customer or accounts. Handwritten signature spaces confirm the goods handed over and received.'), h('div', {
    className: 'form-grid'
  }, field('Challan date', date, setDate, 'date'), field('Invoice / PO reference', reference, setReference), field('Vehicle / courier reference', vehicle, setVehicle), field('Prepared by', preparedBy, setPreparedBy), h(FormField, {
    label: 'Print copy'
  }, h('select', {
    value: copy,
    onChange: event => setCopy(event.target.value)
  }, ['Accounts copy', 'Customer copy', 'Office copy'].map(label => h('option', {
    key: label
  }, label)))), h(FormField, {
    label: 'Remarks'
  }, h('textarea', {
    value: notes,
    onChange: event => setNotes(event.target.value)
  }))), h('p', {
    className: 'quiet'
  }, 'Challan no. ' + number), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error), h('div', {
    className: 'form-actions'
  }, h('button', {
    type: 'button',
    className: 'primary',
    onClick: print
  }, 'Print delivery challan')), h('details', {
    className: 'challan-preview'
  }, h('summary', null, 'Preview delivery challan'), h('div', {
    className: 'challan-preview-scroll'
  }, h('div', {
    ref: paper
  }, h('article', {
    className: 'challan-paper'
  }, h('header', {
    className: 'challan-header'
  }, h('div', null, h('h2', null, 'DELIVERY CHALLAN'), h('p', null, number), h('p', null, 'Date: ' + formatDate(date)), h('p', null, copy)), h('img', {
    src: manufacturingWorkLogo,
    alt: 'Bridges'
  })), h(ManufacturingBarcode, {
    value: number
  }), h('dl', {
    className: 'challan-facts'
  }, fact('Customer', order.customer), fact('System ID', order.id), order.orderNumber && fact('Order number', order.orderNumber), fact('Order title', order.title), fact('Invoice / PO reference', reference), fact('Delivery method', delivery.method), fact('Vehicle / courier', vehicle), fact('Delivery / pickup details', delivery.details), fact('Dispatch date', delivery.dispatchedAt ? formatDate(delivery.dispatchedAt) : '')), h('table', {
    className: 'challan-table'
  }, h('thead', null, h('tr', null, ...['#', 'Description / work order', 'Pieces per pack', 'Packs', 'Total pieces'].map(label => h('th', {
    key: label
  }, label)))), h('tbody', null, rows.map((row, index) => h('tr', {
    key: row.id
  }, h('td', null, index + 1), h('td', null, row.description, h('small', null, row.id + ' · ' + row.type)), h('td', null, row.perPack), h('td', null, row.packs.toLocaleString()), h('td', null, row.quantity.toLocaleString())))), h('tfoot', null, h('tr', null, h('th', {
    colSpan: 3
  }, 'Total delivered'), h('th', null, rows.reduce((sum, row) => sum + row.packs, 0).toLocaleString()), h('th', null, rows.reduce((sum, row) => sum + row.quantity, 0).toLocaleString())))), h('p', {
    className: 'challan-note'
  }, 'Remarks: ' + (notes || '_________________________________________________________________')), h('p', {
    className: 'challan-receipt'
  }, 'Received the above goods. Any shortages, damage or exceptions are noted below.'), h('p', {
    className: 'challan-note'
  }, 'Exceptions: ______________________________________________________________\n_______________________________________________________________________'), h('div', {
    className: 'challan-signatures'
  }, h('div', null, h('strong', null, 'Prepared by'), h('p', null, preparedBy || 'Name: __________________'), h('p', null, 'Signature: ______________')), h('div', null, h('strong', null, 'Delivered by'), h('p', null, 'Name: __________________'), h('p', null, 'Signature: ______________')), h('div', null, h('strong', null, 'Received by (customer)'), h('p', null, 'Name: __________________'), h('p', null, 'Signature: ______________'))), h('div', {
    className: 'challan-receiver'
  }, 'Date & time received: _____________________     Customer stamp: _____________________'), h('footer', {
    className: 'challan-footer'
  }, 'BRIDGES · Delivery record · ' + copy + ' · ' + number + ' · Retain the signed copy for accounting records.'))))));
}

export { ManufacturingDeliveryChallan };
