import {CurrentWorkPanel} from './CurrentWorkPanel.jsx';
import {useCurrentWork} from './useCurrentWork.js';
// features/production/BoxAssignment.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingPrintBox } from "../../domain/boxLabels.js";
import { manufacturingIsCoach } from "../../domain/workforce.js";
import { manufacturingWorkSeconds } from "../../domain/workOrders.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingFinish, manufacturingToday } from "../../utils/dates.js";
import { createId } from "../../utils/ids.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingBoxQr } from "../work-orders/BoxQr.js";

function ManufacturingProductionBoxes({
  productionOrder,
  onUpdateWork
} = {}) {
  const context = useManufacturing(),
    order = productionOrder || context.order,
    workforce = context.workforce,
    updateWork = onUpdateWork || context.updateWork,
    saveBooking = context.saveBooking,
    h = React.createElement,
    [workId, setWorkId] = React.useState(order.workOrders[0]?.id || ''),
    [jobId, setJobId] = React.useState(order.workOrders[0]?.jobs[0]?.id || ''),
    [personId, setPersonId] = React.useState(''),
    [quantity, setQuantity] = React.useState(''),
    [date, setDate] = React.useState(manufacturingFinish(manufacturingToday(), 1)),
    [error, setError] = React.useState(''),
    [lastBox, setLastBox] = React.useState(null), creating = React.useRef(false);
  const work = order.workOrders.find(item => item.id === workId),
    job = work?.jobs.find(item => item.id === jobId),
    individuals = workforce.people.filter(person => !manufacturingIsCoach(person) && person.active !== false),
    boxes = work?.boxes || [],
    allocated = job ? boxes.filter(box => box.jobId === job.id).reduce((sum, box) => sum + Number(box.completedAt || box.status === 'completed' ? box.completedPieces ?? box.quantity : box.quantity), 0) : 0,
    remaining = job ? job.quantity - Math.max(allocated,Number(job.completed||0)+boxes.filter(box=>box.jobId===job.id&&!box.completedAt&&box.status!=='completed').reduce((sum,box)=>sum+Number(box.quantity),0)) : 0,
    defaultQuantity = Math.min(work?.perPack || 0, remaining);
  const current = useCurrentWork(personId,context.orders);
  async function create(event) {
    event.preventDefault();
    setError('');
    if(current.busy||current.checking){setError('Complete the individual’s current work first.');return;}
    const person = individuals.find(item => item.id === personId),
      pieces = Number(quantity || defaultQuantity);
    if (!work || !job || !person) {
      setError('Select a work order, sub-job and individual.');
      return;
    }
    if (!Number.isSafeInteger(pieces) || pieces < 1 || pieces > remaining) {
      setError('Box pieces must be between 1 and ' + remaining + '.');
      return;
    }
    if(creating.current)return;creating.current=true;
    const box = {id:createId('BOX'),jobId:job.id,personId:person.id,quantity:pieces,date,coachId:work.coachId||null};
    const problem = await context.createProductionBox(order.id,work.id,box);
    creating.current=false;
    if(problem){setError(problem);current.reload();return;}
    setQuantity('');
    setLastBox(box);
    // Print from an explicit second tap so browsers allow the print window after an API save.

  }
  return h('div',{className:'single-box-columns'},h('section', {
    className: 'panel production-boxes'
  }, h('h3', null, 'Production · box assignment'), h('p', {
    className: 'quiet'
  }, 'Select the work and sub-job, then print a unique box QR label and assign the box to an individual.'), h('form', {
    onSubmit: create
  }, h('div', {
    className: 'form-grid'
  }, h(FormField, {
    label: 'Work order'
  }, h('select', {
    value: workId,
    onChange: event => {
      const next = order.workOrders.find(item => item.id === event.target.value);
      setWorkId(next.id);
      setJobId(next.jobs[0]?.id || '');
      setQuantity('');
      setLastBox(null);
    }
  }, order.workOrders.map(item => h('option', {
    key: item.id,
    value: item.id
  }, item.description + ' · ' + item.id)))), h(FormField, {
    label: 'Sub-job'
  }, h('select', {
    value: jobId,
    onChange: event => {
      setJobId(event.target.value);
      setQuantity('');
    }
  }, (work?.jobs || []).map(item => h('option', {
    key: item.id,
    value: item.id
  }, item.name + ' · ' + item.quantity + ' pieces')))), h(FormField, {
    label: 'Assign box to individual'
  }, h('select', {
    required: true,
    value: personId,
    onChange: event => setPersonId(event.target.value)
  }, h('option', {
    value: ''
  }, 'Select individual'), individuals.map(person => h('option', {
    key: person.id,
    value: person.id
  }, person.name)))), h(FormField, {
    label: 'Pieces in this box',
    hint: remaining + ' pieces remaining in this sub-job.'
  }, h('input', {
    type: 'number',
    min: 1,
    max: remaining,
    required: true,
    value: quantity || defaultQuantity || '',
    onChange: event => setQuantity(event.target.value)
  })), h(FormField, {
    label: 'Work date'
  }, h('input', {
    type: 'date',
    required: true,
    value: date,
    onChange: event => setDate(event.target.value)
  })), h('div', {
    className: 'production-coach'
  }, h('small', null, 'Job Coach'), h('strong', null, work?.coachName || 'Legacy work order · coach not recorded'))), h('div', {
    className: 'form-actions'
  }, h('button', {
    type: 'button',
    className: 'sample-data-button',
    disabled: !individuals.length,
    onClick: () => {
      setPersonId(individuals[0].id);
      setQuantity(defaultQuantity);
      setDate(manufacturingFinish(manufacturingToday(), 1));
    }
  }, 'Fill sample data'), h('button', {
    className: 'primary',
    disabled: remaining < 1 || !individuals.length || current.busy || current.checking
  }, 'Create & assign box'))), !individuals.length && h('p', {
    className: 'callout'
  }, 'Add individuals in the people directory before assigning boxes.'), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error), lastBox && h('div', {
    className: 'box-created',
    role: 'status'
  }, h(ManufacturingBoxQr, {
    value: lastBox.id
  }), h('div', null, h('strong', null, 'Box created and assigned'), h('p', null, lastBox.id), h('button', {
    onClick: () => setError(manufacturingPrintBox(order, work, work.jobs.find(item => item.id === lastBox.jobId), lastBox, individuals.find(person => person.id === lastBox.personId)))
  }, 'Print QR label again'))), h('h4', {
    className: 'sub-heading'
  }, 'Boxes for this work order'), boxes.length ? h('div', {
    className: 'production-box-list'
  }, boxes.map(box => h('article', {
    key: box.id,
    className: 'production-box-item'
  }, h(ManufacturingBoxQr, {
    value: box.id
  }), h('div', null, h('strong', null, box.id), h('p', null, (work.jobs.find(item => item.id === box.jobId)?.name || box.jobId) + ' · ' + box.quantity + ' pieces' + (box.completedAt ? ' · COMPLETED: ' + box.completedPieces + ' pieces' : ' · Pending completion')), h('p', null, 'Individual: ' + (workforce.people.find(person => person.id === box.personId)?.name || box.personId))), h('button', {
    onClick: () => setError(manufacturingPrintBox(order, work, work.jobs.find(item => item.id === box.jobId), box, workforce.people.find(person => person.id === box.personId)))
  }, 'Print QR label')))) : h('p', {
    className: 'empty'
  }, 'No boxes created for this work order yet.')),h(CurrentWorkPanel,{person:individuals.find(p=>p.id===personId),current,onError:setError}));
}

export { ManufacturingProductionBoxes };
