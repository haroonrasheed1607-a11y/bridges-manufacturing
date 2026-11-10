import { useManufacturing } from "../../state/ManufacturingContext.jsx";
// features/work-orders/WorkOrderForm.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingOrderPlan } from "../../domain/orders.js";
import { validateWorkOrder } from "../../domain/validation.js";
import { manufacturingAutoSubJobs, manufacturingDefaultParts, manufacturingSuggestedPacks, manufacturingWorkSeconds } from "../../domain/workOrders.js";
import { manufacturingFinish, manufacturingToday } from "../../utils/dates.js";
import { createId } from "../../utils/ids.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingAssemblyEditor } from "./AssemblyEditor.js";
import { ManufacturingPaperHeader } from "./PaperHeader.js";
import { ManufacturingPrintSection } from "./PrintSection.js";
import { ManufacturingSubJobSheets } from "./SubJobSheets.js";
import { ManufacturingWorkPlanSummary } from "./WorkPlanSummary.js";

function WorkOrderForm({
  order,
  onSave,
  onCancel
}) {
  const { orderDisplayTitle } = useManufacturing();
  const h = React.createElement,
    [id] = React.useState(() => createId('WO')),
    [type, setType] = React.useState('Assembly'),
    [description, setDescription] = React.useState(''),
    [instructions, setInstructions] = React.useState(''),
    [seconds, setSeconds] = React.useState(Number(order.seconds ?? 30)),
    [packSeconds, setPackSeconds] = React.useState(20),
    [parts, setParts] = React.useState(manufacturingDefaultParts),
    [hoursPerDay, setHoursPerDay] = React.useState(Number(order.hoursPerDay ?? 6)),
    [startDate, setStartDate] = React.useState(order.startDate || manufacturingToday()),
    [required, setRequired] = React.useState(order.required),
    [assignedPeople, setAssignedPeople] = React.useState(''),
    [error, setError] = React.useState(''),
    [packsOverride, setPacksOverride] = React.useState(null);
  const orderPlan = manufacturingOrderPlan(order),
    quantity = orderPlan.quantity,
    perPack = orderPlan.perPack,
    packageSeconds = seconds * perPack + packSeconds,
    totalSeconds = manufacturingWorkSeconds({
      quantity,
      perPack,
      seconds,
      packSeconds,
      timingVersion: 2
    }),
    plan = manufacturingOrderPlan({
      ...order,
      seconds: quantity ? totalSeconds / quantity : seconds,
      hoursPerDay,
      startDate,
      required,
      assignedPeople
    }),
    base = {
      id,
      type,
      description,
      instructions,
      parts: type === 'Assembly' ? parts : [],
      timingVersion: 2,
      quantity,
      perPack,
      packCount: Math.ceil(quantity / perPack),
      seconds,
      packSeconds,
      packageSeconds,
      hoursPerDay,
      startDate,
      required,
      expected: plan.expected,
      people: plan.people,
      recommendedPeople: plan.recommendedPeople,
      assignedPeople: assignedPeople || null,
      totalSeconds,
      audits: [],
      packing: []
    },
    suggestedPacks = manufacturingSuggestedPacks(base),
    packsPerSubJob = packsOverride === null ? suggestedPacks : Number(packsOverride),
    work = {
      ...base,
      packsPerSubJob,
      jobs: manufacturingAutoSubJobs({
        ...base,
        packsPerSubJob
      })
    };
  const field = (label, props, hint) => h(FormField, {
      label,
      hint
    }, h('input', props)),
    numeric = (label, value, set, min = .01, hint) => field(label, {
      type: 'number',
      min,
      max: label === 'Working hours per day' ? 24 : 86400,
      step: .01,
      required: true,
      value: value === 0 ? 0 : value || '',
      onChange: event => set(Number(event.target.value))
    }, hint),
    section = (number, title, ...children) => h('section', {
      className: 'paper-section'
    }, h('h4', {
      className: 'paper-section-title'
    }, number + ' / ' + title), ...children);
  function submit(event) {
    event.preventDefault();
    const problem = validateWorkOrder(work);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(work);
  }
  return h('div', {
    className: 'paper-editor'
  }, h('div', {
    className: 'paper-editor-toolbar'
  }, h('p', {
    className: 'quiet'
  }, 'Prepare the work order, then save it for production.'), h('div', null, h('button', {
    type: 'button',
    className: 'sample-data-button',
    onClick: () => {
      setType('Assembly');
      setDescription('Demo component assembly');
      setInstructions('1. Check parts against the approved sample.\n2. Assemble and inspect each piece.\n3. Count, pack, seal and label the finished boxes.');
      setSeconds(30);
      setPackSeconds(20);
      setParts(manufacturingDefaultParts());
      setHoursPerDay(6);
      setStartDate(manufacturingToday());
      setRequired(order.required >= manufacturingToday() ? order.required : manufacturingFinish(manufacturingToday(), 6));
      setAssignedPeople('');
      setPacksOverride(null);
      setError('');
    }
  }, 'Fill sample data'), h('button', {
    type: 'button',
    onClick: onCancel
  }, 'Cancel'))), h('form', {
    className: 'manufacturing-paper',
    onSubmit: submit
  }, h(ManufacturingPaperHeader, {
    order,
    work
  }), section('01', 'JOB DETAILS', h('div', {
    className: 'form-grid'
  }, field('Customer', {
    value: order.customer,
    readOnly: true
  }), h(FormField, {
    label: 'Kind of job'
  }, h('select', {
    value: type,
    onChange: event => setType(event.target.value)
  }, h('option', null, 'Assembly'), h('option', null, 'Packaging'))), field('Order title', {
    value: orderDisplayTitle(order),
    readOnly: true
  }), field('Total pieces / pieces per pack', {
    value: quantity + ' / ' + perPack,
    readOnly: true
  }), h(FormField, {
    label: 'Description'
  }, h('textarea', {
    required: true,
    value: description,
    onChange: event => setDescription(event.target.value)
  })))), section('02', 'WORK PLAN', h('div', {
    className: 'work-plan-three'
  }, numeric('Time per piece (seconds)', seconds, setSeconds, .01, 'Time to assemble or process one piece.'), numeric('Time to pack all pieces (seconds)', packSeconds, setPackSeconds, 0, 'Packing time for all pieces in one package.'), field('Time per package (seconds)', {
    value: Math.round(packageSeconds * 100) / 100,
    readOnly: true
  }, seconds + ' × ' + perPack + ' pieces + ' + packSeconds + ' sec to pack')), h('div', {
    className: 'work-plan-three'
  }, numeric('Working hours per day', hoursPerDay, setHoursPerDay, .01, 'Default: 6 hours per day.'), field('Production start date', {
    type: 'date',
    required: true,
    value: startDate,
    onChange: event => setStartDate(event.target.value)
  }), field('Required delivery date', {
    type: 'date',
    required: true,
    min: startDate,
    value: required,
    onChange: event => setRequired(event.target.value)
  })), h('div', {
    className: 'work-plan-people'
  }, field('People needed / assigned', {
    type: 'number',
    min: 1,
    step: 1,
    value: assignedPeople || plan.recommendedPeople || '',
    required: true,
    onChange: event => setAssignedPeople(event.target.value)
  }, 'Calculated: ' + plan.recommendedPeople + ' people needed. Edit to assign a different number.'), assignedPeople && h('button', {
    type: 'button',
    onClick: () => setAssignedPeople('')
  }, 'Use calculated number')), h(ManufacturingWorkPlanSummary, {
    work
  })), section('03', type === 'Assembly' ? 'ASSEMBLY INSTRUCTIONS' : 'INSTRUCTIONS', type === 'Assembly' && h(ManufacturingAssemblyEditor, {
    parts,
    onChange: setParts
  }), h(FormField, {
    label: 'Working instructions'
  }, h('textarea', {
    'aria-label': 'Working instructions',
    required: true,
    value: instructions,
    onChange: event => setInstructions(event.target.value),
    placeholder: 'Describe the steps and quality requirements.'
  }))), section('04', 'SUB-JOBS', h('div', {
    className: 'work-plan-people'
  }, field('Packs per sub-job', {
    type: 'number',
    min: 1,
    max: 1000000,
    step: 1,
    required: true,
    value: packsOverride === null ? suggestedPacks : packsOverride,
    onChange: event => setPacksOverride(event.target.value)
  }, 'Suggested: ' + suggestedPacks + ' packs, based on roughly ' + hoursPerDay / 2 + ' hours of work. Change as needed.'), packsOverride !== null && h('button', {
    type: 'button',
    onClick: () => setPacksOverride(null)
  }, 'Use suggestion')), h('p', {
    className: 'paper-section-note'
  }, work.jobs.length + ' sub-jobs · ' + (packsPerSubJob || 0) + ' packs per sub-job. The final sub-job takes the remaining packs.'), h('details', {
    className: 'subjob-generated-preview'
  }, h('summary', null, 'Preview generated sub-jobs and barcodes'), h(ManufacturingSubJobSheets, {
    work
  }))), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error), h('div', {
    className: 'form-actions'
  }, h('button', {
    type: 'button',
    onClick: onCancel
  }, 'Cancel'), h('button', {
    className: 'primary',
    disabled: !work.jobs.length
  }, 'Save work order'))), h(ManufacturingPrintSection, {
    order,
    work
  }));
}

export { WorkOrderForm };
