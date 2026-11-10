// features/orders/CreateOrderPage.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingRepeatDays } from "../../domain/orders.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingFinish, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingOrderPictureUpload } from "./OrderPictureUpload.js";

function CreateOrderPage() {
  const {
      create,
      setView,
      open, customerCatalog = []
    } = useManufacturing(),
    h = React.createElement;
  const [clientId, setClientId] = React.useState(''), [itemId, setItemId] = React.useState('');
  const client = customerCatalog.find(row => row.id === clientId);
  const item = client?.items.find(row => row.id === itemId);
  const [createdId, setCreatedId] = React.useState(''),
    [pictures, setPictures] = React.useState([]),
    [uploading, setUploading] = React.useState(false),
    [submitError, setSubmitError] = React.useState(''),
    submitting = React.useRef(false);
  React.useEffect(() => {
    if (!createdId) return;
    const timer = setTimeout(() => open(createdId), 2000);
    return () => clearTimeout(timer);
  }, [createdId]);
  const [frequency, setFrequency] = React.useState('one-time'),
    [customDays, setCustomDays] = React.useState(10),
    [quantity, setQuantity] = React.useState(0),
    [perPack, setPerPack] = React.useState(25),
    [required, setRequired] = React.useState('');
  const packCount = perPack > 0 ? Math.ceil(quantity / perPack) : 0;
  const repeatEveryDays = manufacturingRepeatDays(frequency, customDays);
  const field = (label, props, hint) => h(FormField, {
    label,
    hint
  }, h('input', props));
  const section = (number, title, description, ...children) => h('fieldset', {
    className: 'order-form-section'
  }, h('legend', null, h('span', {
    className: 'order-section-number',
    'aria-hidden': true
  }, number), title), h('p', {
    className: 'order-section-description'
  }, description), h('div', {
    className: 'form-grid'
  }, ...children));
  if (createdId) return h('div', {
    className: 'order-created-splash',
    role: 'status',
    'aria-live': 'polite'
  }, h('div', {
    className: 'order-created-splash-card'
  }, h('div', {
    className: 'order-created-check',
    'aria-hidden': true
  }, '✓'), h('h2', null, 'Order created'), item && h('p', null, item.name), h('small', null, createdId), h('p', {
    className: 'quiet'
  }, 'Opening your order…')));
  return h(React.Fragment, null, h('button', {
    className: 'back',
    onClick: () => setView('orders')
  }, '← All orders'), h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, '01 / NEW ORDER'), h('h2', null, 'Order details'), h('p', {
    className: 'quiet'
  }, 'Define the order, quantities, and customer deadline.'))), h('form', {
    className: 'panel form-panel order-details-form',
    onSubmit: async event => {
      event.preventDefault();
      if (submitting.current || uploading || !item) return;
      submitting.current = true;
      setSubmitError('');
      const id = await create({
        ...Object.fromEntries(new FormData(event.currentTarget)),
        title: item.name, customer: client.name, catalogItemId: item.id,
        quantity,
        perPack,
        packCount,
        frequency,
        repeatEveryDays,
        pictures,
        expected: null
      });
      if (!id) {
        submitting.current = false;
        setSubmitError('Unable to save the order. Check the connection message and try again.');
        return;
      }
      setCreatedId(id);
    }
  }, h('div', {
    className: 'order-created-notice',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': true
  }, createdId ? '✓ Order has been created. Reference: ' + createdId : ''), h('div', {
    className: 'sample-form-toolbar'
  }, h('button', {
    type: 'button',
    className: 'sample-data-button',
    onClick: () => {
      const sampleClient = customerCatalog.find(row => row.items.length);
      setClientId(sampleClient?.id || '');
      setItemId(sampleClient?.items[0]?.id || '');
      setQuantity(1200);
      setPerPack(25);
      setFrequency('custom');
      setCustomDays(10);
      setRequired(manufacturingFinish(manufacturingToday(), 6));
      setCreatedId('');
    }
  }, 'Fill sample data'), h('small', null, 'Fills this form for testing. Review before creating the order.')), section('01', 'Client and item', 'Choose an item from the registered client’s catalog.', h(FormField, {label:'Client'},
    h('select', {required:true,value:clientId,onChange:event=>{setClientId(event.target.value);setItemId('');}},
      h('option',{value:''},'Select a client'),
      ...customerCatalog.map(row=>h('option',{key:row.id,value:row.id},row.name)))),
    h(FormField,{label:'Item',hint:item?.rate == null ? undefined : 'Catalog rate: ' + item.rate},
      h('select',{required:true,value:itemId,disabled:!client?.items.length,onChange:event=>setItemId(event.target.value)},
        h('option',{value:''},client && !client.items.length ? 'No items registered for this client' : 'Select an item'),
        ...(client?.items || []).map(row=>h('option',{key:row.id,value:row.id},row.code+' · '+row.name)))),
    (!customerCatalog.length || (client && !client.items.length)) && h('button',{
      type:'button',className:'text-link',onClick:()=>setView('customers')
    },'Open client registration'), h(ManufacturingOrderPictureUpload, {
    pictures,
    onChange: setPictures,
    onBusy: setUploading
  })), section('02', 'Quantities', 'Set the quantity for each order or repeat.', field('Total pieces required', {
    type: 'number',
    name: 'quantity',
    min: 1,
    max: 1000000,
    step: 1,
    required: true,
    value: quantity || '',
    onChange: event => setQuantity(Number(event.target.value))
  }, repeatEveryDays ? 'Pieces required every ' + repeatEveryDays + ' ' + (repeatEveryDays === 1 ? 'day.' : 'days.') : 'Pieces required for this order.'), h(FormField, {
    label: 'Order frequency',
    hint: frequency === 'one-time' ? 'A single order with no repeat schedule.' : 'The quantity above applies to each repeat. Intervals use calendar days.'
  }, h('select', {
    name: 'frequency',
    value: frequency,
    onChange: event => setFrequency(event.target.value)
  }, h('option', {
    value: 'one-time'
  }, 'One-time order'), h('option', {
    value: 'weekly'
  }, 'Weekly — Every 7 days'), h('option', {
    value: 'fortnightly'
  }, 'Fortnightly — Every 14 days'), h('option', {
    value: 'custom'
  }, 'Custom — Every X days')), frequency === 'custom' && h('label', {
    className: 'custom-repeat-field'
  }, h('span', null, 'Repeat every (days)'), h('input', {
    type: 'number',
    name: 'repeatEveryDays',
    min: 1,
    max: 3650,
    step: 1,
    required: true,
    value: customDays || '',
    onChange: event => setCustomDays(Number(event.target.value))
  }), h('small', null, repeatEveryDays ? 'Every ' + repeatEveryDays + ' ' + (repeatEveryDays === 1 ? 'day' : 'days') : 'Enter a whole number of days.'))), field('Pieces per pack', {
    type: 'number',
    name: 'perPack',
    min: 1,
    max: 1000000,
    step: 1,
    required: true,
    value: perPack || '',
    onChange: event => setPerPack(Number(event.target.value))
  }), h('div', {
    className: 'order-section-result',
    'aria-live': 'polite'
  }, h('span', null, 'Packs required'), h('strong', null, packCount.toLocaleString()), h('small', null, quantity % perPack ? Math.floor(quantity / perPack) + ' full + 1 pack with ' + quantity % perPack + ' pieces' : 'Full packs · calculated automatically'))), section('03', 'Deadlines', 'Record the customer’s required delivery date.', field('Required delivery date', {
    type: 'date',
    name: 'required',
    required: true,
    value: required,
    onChange: event => setRequired(event.target.value)
  }, 'The manager will set production timing and the delivery forecast when finalizing the work order.')), submitError && h('p', {
    className: 'alert',
    role: 'alert'
  }, submitError), h('div', {
    className: 'form-actions'
  }, h('button', {
    type: 'button',
    onClick: () => setView('orders')
  }, 'Cancel'), h('button', {
    className: 'primary',
    disabled: !!createdId || uploading || !item
  }, uploading ? 'Preparing pictures…' : 'Create order'))));
}

export { CreateOrderPage };
