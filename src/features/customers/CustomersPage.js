// features/customers/CustomersPage.js
import { FormField } from "../../components/common/FormField.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { manufacturingFillFields } from "../../utils/forms.js";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingCustomers() {
  const {
      orders,
      open,
      customers,
      addCustomer
    } = useManufacturing(),
    h = React.createElement;
  const [adding, setAdding] = React.useState(false),
    [error, setError] = React.useState(''),
    [message, setMessage] = React.useState('');
  return h(React.Fragment, null, h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, 'OPERATIONS / CUSTOMERS'), h('h2', null, 'Customers'), h('p', {
    className: 'quiet'
  }, 'Customers and their orders.')), h('button', {
    className: 'primary',
    onClick: () => {
      setAdding(true);
      setError('');
      setMessage('');
    }
  }, '＋ Add customer')), adding && h('form', {
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
      setMessage('Customer added.');
    }
  }, h('div', {
    className: 'section-heading'
  }, h('h3', null, 'Add customer'), h('button', {
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
  }, 'Save customer'))), h('p', {
    role: 'status',
    className: 'quiet'
  }, message), h('section', {
    className: 'panel'
  }, customers.length ? h('div', {
    className: 'table-wrap'
  }, h('table', null, h('thead', null, h('tr', null, ['Customer', 'Total orders', 'Active orders', 'Orders'].map(label => h('th', {
    key: label
  }, label)))), h('tbody', null, customers.map(name => {
    const items = orders.filter(order => order.customer.trim().toLowerCase() === name.toLowerCase());
    return h('tr', {
      key: name
    }, h('td', null, name), h('td', null, items.length), h('td', null, items.filter(order => order.stage < 6).length), h('td', null, items.length ? items.map(order => h('button', {
      key: order.id,
      className: 'text-link',
      style: {
        marginRight: 16
      },
      onClick: () => open(order.id)
    }, order.id)) : '—'));
  })))) : h('p', {
    className: 'empty'
  }, 'No customers yet. Add your first customer to get started.')));
}

export { ManufacturingCustomers };
