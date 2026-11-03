// features/production/ScanComplete.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingFindBox } from "../../domain/production.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBoxQr } from "../work-orders/BoxQr.js";

function ManufacturingScanComplete() {
  const {
      orders,
      workforce,
      completeProductionBox
    } = useManufacturing(),
    h = React.createElement,
    [code, setCode] = React.useState(''),
    [selectedCode, setSelectedCode] = React.useState(''),
    [pieces, setPieces] = React.useState(''),
    [error, setError] = React.useState(''),
    [message, setMessage] = React.useState(''),
    [last, setLast] = React.useState(null),
    scanner = React.useRef(null),
    saving = React.useRef(false);
  const selected = manufacturingFindBox(orders, selectedCode),
    completed = selected && (selected.box.completedAt || selected.box.status === 'completed'),
    individual = selected && workforce.people.find(person => person.id === selected.box.personId),
    recent = orders.flatMap(order => order.workOrders.flatMap(work => (work.boxes || []).filter(box => box.completedAt).map(box => ({
      order,
      work,
      box
    })))).sort((a, b) => b.box.completedAt.localeCompare(a.box.completedAt)).slice(0, 8);
  function focusScanner() {
    scanner.current?.focus();
    scanner.current?.select();
  }
  function scan(value) {
    saving.current = false;
    setMessage('');
    setLast(null);
    setError('');
    const found = manufacturingFindBox(orders, value);
    if (!found) {
      setSelectedCode('');
      setError('No box found for this code. Scan the box label again.');
      focusScanner();
      return;
    }
    setCode(found.box.id);
    setSelectedCode(found.box.id);
    setPieces(String(found.box.completedPieces ?? found.box.quantity));
    if (found.box.completedAt || found.box.status === 'completed') setError('This box was already completed on ' + formatTimestamp(found.box.completedAt) + '. It will not be counted again.');else if (found.order.stage !== 1) setError('This order is not currently in production.');
  }
  async function complete(event) {
    event.preventDefault();
    if (!selected || saving.current) return;
    saving.current = true;
    const result = await completeProductionBox(selected.box.id, Number(pieces));
    if (result.error) {
      saving.current = false;
      setError(result.error);
      return;
    }
    setLast({
      ...result,
      individualName: individual?.name || selected.box.personId,
      orderTitle: selected.order.title
    });
    setMessage('Box completed · ' + result.box.completedPieces + ' pieces recorded. Ready for the next scan.');
    setSelectedCode('');
    setCode('');
    setPieces('');
    setError('');
    focusScanner();
  }
  return h('div', {
    className: 'production-line-page'
  }, h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, 'SCAN & COMPLETE WORK'), h('h2', null, 'Scan & complete work'), h('p', {
    className: 'quiet'
  }, 'Scan the box barcode or QR label using the connected scanner, then confirm completed pieces.')), h('button', {
    type: 'button',
    onClick: focusScanner
  }, 'Focus scanner')), h('section', {
    className: 'panel scanner-panel'
  }, h('form', {
    onSubmit: event => {
      event.preventDefault();
      scan(code);
    }
  }, h('label', {
    className: 'field scanner-field',
    htmlFor: 'production-box-scan'
  }, h('span', null, 'Scan box code'), h('input', {
    id: 'production-box-scan',
    ref: scanner,
    autoFocus: true,
    autoComplete: 'off',
    autoCapitalize: 'characters',
    spellCheck: false,
    value: code,
    placeholder: 'Scan a box label…',
    onChange: event => setCode(event.target.value)
  })), h('div', {
    className: 'scanner-actions'
  }, h('button', {
    className: 'primary',
    disabled: !code.trim()
  }, 'Find box'), h('button', {
    type: 'button',
    className: 'sample-data-button',
    onClick: () => {
      const sample = orders.flatMap(order => order.stage === 1 ? order.workOrders.flatMap(work => (work.boxes || []).filter(box => !box.completedAt && box.status !== 'completed')) : [])[0];
      if (sample) scan(sample.id);else setError('Create and assign a box in production first, then use this button to load it.');
    }
  }, 'Load a test box'))), h('p', {
    className: 'scanner-help'
  }, 'Scanners that type the code and send Enter work here. You can also type or paste a box ID and choose Find box.')), error && h('div', {
    className: 'alert',
    role: 'alert'
  }, error), h('div', {
    className: message ? 'scanner-success' : '',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': true
  }, message), selected && h('section', {
    className: 'panel scanned-box-panel'
  }, h('div', {
    className: 'section-heading'
  }, h('div', null, h('h3', null, completed ? 'Box already completed' : 'Box ready to complete'), h('p', {
    className: 'quiet'
  }, selected.box.id)), h('span', {
    className: 'badge ' + (completed ? 'green' : '')
  }, completed ? 'Completed' : 'In production')), h('div', {
    className: 'scanned-box-layout'
  }, h(ManufacturingBoxQr, {
    value: selected.box.id
  }), h('dl', {
    className: 'scanned-box-facts'
  }, ...Object.entries({
    'Order': selected.order.title,
    'Work order': selected.work.description,
    'Sub-job': selected.job?.name || selected.box.jobId,
    'Individual': individual?.name || selected.box.personId,
    'Job Coach': selected.work.coachName || '—',
    'Box quantity': selected.box.quantity + ' pieces'
  }).map(([label, value]) => h('div', {
    key: label
  }, h('dt', null, label), h('dd', null, value))))), h('form', {
    onSubmit: complete
  }, h(FormField, {
    label: 'Completed pieces',
    hint: 'Defaults to the box quantity. Change only if the actual completed quantity differs.'
  }, h('input', {
    type: 'number',
    min: 0,
    max: selected.box.quantity,
    step: 1,
    required: true,
    value: pieces,
    onChange: event => setPieces(event.target.value),
    disabled: !!completed
  })), h('div', {
    className: 'scanner-complete-actions'
  }, h('button', {
    type: 'button',
    onClick: () => {
      setSelectedCode('');
      setCode('');
      setError('');
      focusScanner();
    }
  }, 'Scan another box'), h('button', {
    className: 'primary scanner-complete',
    disabled: !!completed || selected.order.stage !== 1
  }, 'Mark box as completed')))), last && h('section', {
    className: 'panel scanner-last'
  }, h('h3', null, 'Last completed box'), h('p', null, last.box.id + ' · ' + last.individualName), h('p', {
    className: 'quiet'
  }, last.box.completedPieces + ' pieces · ' + last.job.completed + ' / ' + last.job.quantity + ' pieces completed in ' + last.job.name), last.box.completedPieces < last.box.quantity && h('p', {
    className: 'callout'
  }, last.box.quantity - last.box.completedPieces + ' pieces were not completed. They remain outstanding and can be allocated to a new box.')), h('section', {
    className: 'panel'
  }, h('h3', null, 'Recently completed boxes'), recent.length ? h('div', {
    className: 'scanner-recent-list'
  }, recent.map(({
    order,
    work,
    box
  }) => h('article', {
    key: box.id
  }, h('div', null, h('strong', null, box.id), h('p', null, order.title + ' · ' + (workforce.people.find(person => person.id === box.personId)?.name || box.personId)), h('small', {
    className: 'quiet'
  }, box.completedPieces + ' pieces · ' + formatTimestamp(box.completedAt))), h('button', {
    type: 'button',
    onClick: () => scan(box.id)
  }, 'View box')))) : h('p', {
    className: 'empty'
  }, 'Completed boxes will appear here.')));
}

export { ManufacturingScanComplete };
