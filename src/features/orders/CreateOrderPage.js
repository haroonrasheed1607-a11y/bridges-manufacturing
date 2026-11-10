// features/orders/CreateOrderPage.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingCanEditOrderRequest, manufacturingRepeatDays } from "../../domain/orders.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingFinish, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingOrderPictureUpload } from "./OrderPictureUpload.js";

function CreateOrderPage({ existingOrder, onClose } = {}) {
  const {
      create, change, storageError,
      setView,
      open, customerCatalog = []
    } = useManufacturing(),
    h = React.createElement;
  const savedClient = existingOrder && customerCatalog.find(row => row.name === existingOrder.customer);
  const savedClientId = savedClient?.id ?? (existingOrder ? 'saved-client' : '');
  const savedItemId = existingOrder ? existingOrder.catalogItemId ?? 'saved-item' : '';
  const [clientId, setClientId] = React.useState(savedClientId), [itemId, setItemId] = React.useState(savedItemId);
  const client = customerCatalog.find(row => row.id === clientId);
  const item = client?.items.find(row => row.id === itemId);
  const showSavedItem = existingOrder && clientId === savedClientId && !client?.items.some(row => row.id === savedItemId);
  const keepSavedItem = existingOrder && clientId === savedClientId && itemId === savedItemId;
  const hasSelection = !!item || !!keepSavedItem;
  const [orderNumber, setOrderNumber] = React.useState(existingOrder?.orderNumber ?? ''),
    [createdId, setCreatedId] = React.useState(''),
    [pictures, setPictures] = React.useState(existingOrder?.pictures ?? []),
    [uploading, setUploading] = React.useState(false),
    [submitError, setSubmitError] = React.useState(''),
    submitting = React.useRef(false);
  React.useEffect(() => {
    if (!createdId) return;
    const timer = setTimeout(() => open(createdId), 2000);
    return () => clearTimeout(timer);
  }, [createdId]);
  const [frequency, setFrequency] = React.useState(existingOrder?.frequency ?? 'one-time'),
    [customDays, setCustomDays] = React.useState(existingOrder?.repeatEveryDays ?? 10),
    [quantity, setQuantity] = React.useState(existingOrder?.quantity ?? 0),
    [perPack, setPerPack] = React.useState(existingOrder?.perPack ?? 25),
    [required, setRequired] = React.useState(existingOrder?.required ?? '');
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
  }, '✓'), h('h2', null, 'Order created'), item && h('p', null, item.name + ' · ' + item.code), orderNumber.trim() && h('p', null, 'Order number: ' + orderNumber.trim()), h('small', null, 'System ID: ' + createdId), h('p', {
    className: 'quiet'
  }, 'Opening your order…')));
  return h(React.Fragment, null, h('div', {
    className: 'page-heading'
  }, h('h2', null, existingOrder ? 'Edit order request' : 'Order details')), h('form', {
    className: 'panel form-panel order-details-form',
    onSubmit: async event => {
      event.preventDefault();
      if (submitting.current || uploading || !hasSelection) return;
      submitting.current = true;
      setSubmitError('');
      const fields = {
        ...(keepSavedItem ? {} : {
          title: item.name, customer: client.name, catalogItemId: item.id,
          ...(existingOrder ? { catalogCode: item.code, catalogRate: item.rate ?? null } : {}),
        }),
        orderNumber: orderNumber.trim(),
        quantity,
        perPack,
        packCount,
        frequency,
        repeatEveryDays,
        pictures,
        required,
        expected: null
      };
      if (existingOrder) {
        const saved = await change(existingOrder.id, current => {
          if (!manufacturingCanEditOrderRequest(current)) {
            throw new Error('A work order has been created. The order request can no longer be edited.');
          }
          if (current._revision !== existingOrder._revision) {
            throw new Error('This request changed while you were editing. Reopen the editor to review it.');
          }
          return { ...current, ...fields };
        }, 'Order request updated.');
        if (saved) onClose();
        else {
          submitting.current = false;
          setSubmitError('Unable to update the order request.');
        }
        return;
      }
      const id = await create(fields);
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
  }, createdId ? '✓ Order has been created. System ID: ' + createdId : ''), !existingOrder && h('div', {
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
      existingOrder && !savedClient && h('option',{value:savedClientId},existingOrder.customer),
      ...customerCatalog.map(row=>h('option',{key:row.id,value:row.id},row.name)))),
    h(FormField,{label:'Item',hint:item?.rate == null ? undefined : 'Catalog rate: ' + item.rate},
      h('select',{required:true,value:itemId,disabled:!client?.items.length && !showSavedItem,onChange:event=>setItemId(event.target.value)},
        h('option',{value:''},client && !client.items.length ? 'No items registered for this client' : 'Select an item'),
        showSavedItem && h('option',{value:savedItemId},existingOrder.title),
        ...(client?.items || []).map(row=>h('option',{key:row.id,value:row.id},row.name + ' · ' + row.code)))),
    field('Order number', {
      value: orderNumber,
      onChange: event => setOrderNumber(event.target.value)
    }, 'Optional customer or purchase order number.'), field('System ID', {
      readOnly: true,
      value: existingOrder?.id ?? 'Assigned when saved'
    }),
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
  }, existingOrder && storageError ? storageError : submitError), h('div', {
    className: 'form-actions'
  }, h('button', {
    type: 'button',
    onClick: existingOrder ? onClose : () => setView('orders')
  }, 'Cancel'), h('button', {
    className: 'primary',
    disabled: !!createdId || uploading || !hasSelection
  }, uploading ? 'Preparing pictures…' : existingOrder ? 'Save changes' : 'Create order request'))));
}

export { CreateOrderPage };
