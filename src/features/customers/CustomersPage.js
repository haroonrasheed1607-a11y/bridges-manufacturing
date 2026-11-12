import { ClientCatalog } from "./ClientCatalog.jsx";
// features/customers/CustomersPage.js
import { FormField } from "../../components/common/FormField.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingFillFields } from "../../utils/forms.js";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingCustomers() {
  const {
      customers,
      addCustomer, customerCatalog = [], saveCustomerItem
    } = useManufacturing(),
    h = React.createElement;
  const [adding, setAdding] = React.useState(false),
    [error, setError] = React.useState(''),
    [message, setMessage] = React.useState('');
  return h(React.Fragment, null, h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, 'OPERATIONS / CLIENTS'), h('h2', null, 'Clients'), h('p', {
    className: 'quiet'
  }, 'Manage each client’s items, units and rates.')), h('button', {
    className: 'primary',
    onClick: () => {
      setAdding(true);
      setError('');
      setMessage('');
    }
  }, '＋ Register client')), adding && h('form', {
    className: 'panel form-panel',
    onSubmit: async event => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get('customerName');
      const problem = await addCustomer(name);
      if (problem) {
        setError(problem);
        return;
      }
      setAdding(false);
      setMessage('Client registered.');
    }
  }, h('div', {
    className: 'section-heading'
  }, h('h3', null, 'Register client'), h('button', {
    type: 'button',
    className: 'sample-data-button',
    onClick: event => {
      let index = 1;
      while (customers.includes('Demo Customer ' + index)) index++;
      manufacturingFillFields(event.currentTarget.form, {
        customerName: 'Demo Customer ' + index
      });
      setError('');
    }
  }, 'Fill sample data')), h(FormField, {
    label: 'Customer name'
  }, h('input', {
    name: 'customerName',
    required: true,
    maxLength: 160,
    autoFocus: true,
    placeholder: 'Customer or company'
  })), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error), h('div', {
    className: 'form-actions'
  }, h('button', {
    type: 'button',
    onClick: () => setAdding(false)
  }, 'Cancel'), h('button', {
    className: 'primary',
    type: 'submit'
  }, 'Save client'))), h('p', {
    role: 'status',
    className: 'quiet'
  }, message), h(ClientCatalog, {clients:customerCatalog,onSaveItem:saveCustomerItem}));
}

export { ManufacturingCustomers };
