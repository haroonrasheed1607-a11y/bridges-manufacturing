import { ScannerDailyWork } from './ScannerDailyWork.jsx';
import {DumpingScanner} from '../dumping/DumpingScanner.jsx';
import {isDumpingCode, isIndividualJobCode} from '../dumping/model.js';
import { QrCamera } from './QrCamera.jsx';
// features/production/ScanComplete.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingFindBox } from "../../domain/production.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatTimestamp } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBoxQr } from "../work-orders/BoxQr.js";

function ManufacturingScanComplete({minimal=false} = {}) {
  const {
      orders, orderDisplayTitle,
      workforce,
      completeProductionBox
    } = useManufacturing(),
    h = React.createElement,
    [cameraOpen, setCameraOpen] = React.useState(false),
    [dumpCode,setDumpCode] = React.useState(''),
    dumpLock = React.useRef(false),
    [code, setCode] = React.useState(''),
    [selectedCode, setSelectedCode] = React.useState(''),
    [pieces, setPieces] = React.useState(''),
    [error, setError] = React.useState(''),
    [message, setMessage] = React.useState(''),
    [last, setLast] = React.useState(null),
    scanner = React.useRef(null),
    saving = React.useRef(false);
  React.useEffect(() => { if (selectedCode) document.querySelector('.scanned-box-panel')?.scrollIntoView({behavior:'smooth',block:'start'}); }, [selectedCode]);
  React.useEffect(() => {
    if (!minimal || dumpCode || cameraOpen || selectedCode) return;
    let buffer = '', lastKey = 0;
    function readScanner(event) {
      if (event.target?.matches?.('input,select,textarea,[contenteditable="true"]') || event.ctrlKey || event.altKey || event.metaKey) return;
      if (Date.now() - lastKey > 150) buffer = '';
      lastKey = Date.now();
      if (event.key === 'Enter') { if (buffer.length >= 5) scan(buffer); buffer = ''; }
      else if (event.key.length === 1) buffer += event.key;
    }
    window.addEventListener('keydown', readScanner);
    return () => window.removeEventListener('keydown', readScanner);
  }, [minimal, dumpCode, cameraOpen, selectedCode, orders]);
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
  function scan(value, preview = false) {
    if(dumpLock.current || saving.current)return;
    if(isDumpingCode(value) || isIndividualJobCode(value)){
      dumpLock.current=true;setDumpCode(String(value).trim().toUpperCase());setCode('');setSelectedCode('');setError('');return;
    }
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
    else if (!preview) void recordBox(found, found.box.quantity);
  }
  async function complete(event) {
    event.preventDefault();
    if (selected) await recordBox(selected, Number(pieces));
  }
  async function recordBox(selected, quantity) {
    if (saving.current) return;
    saving.current = true;
    const result = await completeProductionBox(selected.box.id, quantity);
    saving.current = false;
    if (result.error) {
      setError(result.error);
      return;
    }
    setLast({
      ...result,
      individualName: workforce.people.find(person => person.id === selected.box.personId)?.name || selected.box.personId,
      orderTitle: orderDisplayTitle(selected.order)
    });
    setMessage('Box completed · ' + result.box.completedPieces + ' pieces recorded. Ready for the next scan.');
    setSelectedCode('');
    setCode('');
    setPieces('');
    setError('');
    focusScanner();
  }
  if(dumpCode)return h(DumpingScanner,{key:dumpCode,code:dumpCode,onDone:()=>{setDumpCode('');dumpLock.current=false;setTimeout(focusScanner,0);}});
  return h('div', {
    className: 'production-line-page'
  }, minimal && h(ScannerDailyWork, {refreshKey:message}), !minimal && h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, 'SCAN & COMPLETE WORK'), h('h2', null, 'Scan & complete work'), h('p', {
    className: 'quiet'
  }, 'Scan a box or Individual Job QR with your phone camera, use a connected scanner, or enter the code. A single-use scan completes the assigned box. Reusable barcodes prompt for load size.')), h('button', {
    type: 'button',
    onClick: focusScanner
  }, 'Focus scanner')), !minimal && h('section', {
    className: 'panel scanner-panel'
  }, !minimal && h('form', {
    onSubmit: event => {
      event.preventDefault();
      scan(code);
    }
  }, h('label', {
    className: 'field scanner-field',
    htmlFor: 'production-box-scan'
  }, h('span', null, minimal ? 'Box ID' : 'Scan box code'), h('input', {
    id: 'production-box-scan',
    ref: scanner,
    autoFocus: false,
    autoComplete: 'off',
    autoCapitalize: 'characters',
    spellCheck: false,
    value: code,
    placeholder: minimal ? 'Enter box ID and press Enter' : 'Scan a box label…',
    onChange: event => setCode(event.target.value)
  })), !minimal && h('div', {
    className: 'scanner-actions'
  }, h('button', {
    className: 'primary',
    disabled: !code.trim()
  }, 'Scan code'), h('button', {
    type: 'button',
    className: 'sample-data-button',
    onClick: () => {
      const sample = orders.flatMap(order => order.stage === 1 ? order.workOrders.flatMap(work => (work.boxes || []).filter(box => !box.completedAt && box.status !== 'completed')) : [])[0];
      if (sample) scan(sample.id, true);else setError('Create and assign a box in production first, then use this button to load it.');
    }
  }, 'Load a test box'))), !minimal && h('p', {
    className: 'scanner-help'
  }, 'Scanners that type the code and send Enter work here. You can also type or paste a box ID and choose Scan code.')), error && h('div', {
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
  }, !minimal && h(ManufacturingBoxQr, {
    value: selected.box.id
  }), h('dl', {
    className: 'scanned-box-facts'
  }, ...Object.entries({
    'Order': orderDisplayTitle(selected.order),
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
  }, 'Mark box as completed')))), !minimal && last && h('section', {
    className: 'panel scanner-last'
  }, h('h3', null, 'Last completed box'), h('p', null, last.box.id + ' · ' + last.individualName), h('p', {
    className: 'quiet'
  }, last.box.completedPieces + ' pieces · ' + last.job.completed + ' / ' + last.job.quantity + ' pieces completed in ' + last.job.name), last.box.completedPieces < last.box.quantity && h('p', {
    className: 'callout'
  }, last.box.quantity - last.box.completedPieces + ' pieces were not completed. They remain outstanding and can be allocated to a new box.')), !minimal && h('section', {
    className: 'panel'
  }, h('h3', null, 'Recently completed boxes'), recent.length ? h('div', {
    className: 'scanner-recent-list'
  }, recent.map(({
    order,
    work,
    box
  }) => h('article', {
    key: box.id
  }, h('div', null, h('strong', null, box.id), h('p', null, orderDisplayTitle(order) + ' · ' + (workforce.people.find(person => person.id === box.personId)?.name || box.personId)), h('small', {
    className: 'quiet'
  }, box.completedPieces + ' pieces · ' + formatTimestamp(box.completedAt))), h('button', {
    type: 'button',
    onClick: () => scan(box.id)
  }, 'View box')))) : h('p', {
    className: 'empty'
  }, 'Completed boxes will appear here.')), h('div', {className:'shop-floor-scan-dock'}, h('button', {type:'button',className:'primary',onClick:()=>setCameraOpen(true),'aria-haspopup':'dialog'}, '▣  Scan QR code')), cameraOpen && h(QrCamera,{onClose:()=>setCameraOpen(false),onScan:value=>{setCameraOpen(false);scan(value);}}));
}

export { ManufacturingScanComplete };
