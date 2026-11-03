// features/customers/CustomerSelect.js
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingCustomerSelect({
  sampleCustomer = '',
  sampleKey = 0
} = {}) {
  const {
      customers: storedCustomers
    } = useManufacturing(),
    h = React.createElement;
  const customers = [...new Set([...storedCustomers, ...(sampleCustomer ? [sampleCustomer] : [])])];
  const [query, setQuery] = React.useState(''),
    [expanded, setExpanded] = React.useState(false),
    [active, setActive] = React.useState(-1);
  const input = React.useRef(null),
    id = React.useId();
  React.useEffect(() => {
    if (sampleCustomer) {
      setQuery(sampleCustomer);
      setExpanded(false);
      setActive(-1);
    }
  }, [sampleCustomer, sampleKey]);
  const options = customers.filter(name => name.toLowerCase().includes(query.toLowerCase()));
  const selected = customers.find(name => name.toLowerCase() === query.trim().toLowerCase());
  React.useEffect(() => {
    input.current?.setCustomValidity(selected ? '' : 'Select a saved customer from the dropdown.');
  }, [selected]);
  function choose(name) {
    setQuery(name);
    setExpanded(false);
    setActive(-1);
    input.current?.focus();
  }
  return h('div', {
    className: 'field'
  }, h('label', {
    htmlFor: id
  }, 'Customer name'), h('div', {
    className: 'customer-select',
    onBlur: event => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setExpanded(false);
        setActive(-1);
      }
    }
  }, h('input', {
    id,
    ref: input,
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': expanded,
    'aria-controls': id + '-options',
    'aria-activedescendant': expanded && active >= 0 ? id + '-option-' + active : undefined,
    required: true,
    autoFocus: true,
    autoComplete: 'off',
    placeholder: 'Search or select a customer…',
    value: query,
    onFocus: () => setExpanded(true),
    onClick: () => setExpanded(true),
    onChange: event => {
      setQuery(event.target.value);
      setExpanded(true);
      setActive(-1);
    },
    onKeyDown: event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setExpanded(true);
        setActive(index => options.length ? index < 0 ? event.key === 'ArrowDown' ? 0 : options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : -1);
      } else if (event.key === 'Enter' && expanded && active >= 0) {
        event.preventDefault();
        choose(options[active]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(false);
        setActive(-1);
      }
    }
  }), h('input', {
    type: 'hidden',
    name: 'customer',
    value: selected || ''
  }), expanded && h('div', {
    id: id + '-options',
    role: 'listbox',
    className: 'customer-options',
    'aria-label': 'Customers'
  }, options.length ? options.map((name, index) => h('div', {
    key: name,
    id: id + '-option-' + index,
    role: 'option',
    'aria-selected': index === active,
    className: index === active ? 'active' : '',
    onMouseDown: event => event.preventDefault(),
    onClick: () => choose(name)
  }, name)) : h('div', {
    className: 'customer-no-results'
  }, 'No matching customers. Add a customer on the Customers page.'))), h('small', null, 'Choose a saved customer. Add new customers on the Customers page.'));
}

export { ManufacturingCustomerSelect };
