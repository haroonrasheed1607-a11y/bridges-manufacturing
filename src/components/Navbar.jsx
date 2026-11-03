// components/layout/Navigation.js
import { useManufacturing } from "../state/ManufacturingContext.jsx";
import { React } from "../vendor/react-runtime.js";

function Navbar() {
  const {
      setView,
      view, manager
    } = useManufacturing(),
    h = React.createElement,
    [expanded, setExpanded] = React.useState(''),
    root = React.useRef(null);
  React.useEffect(() => {
    function close(event) {
      if (root.current && !root.current.contains(event.target)) setExpanded('');
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const active = route => route === 'orders' ? ['orders', 'new', 'detail'].includes(view) : route === view;
  function link(label, route, detail) {
    return h('a', {
      key: route,
      href: '#' + route,
      className: 'nav-text-link',
      'aria-current': active(route) ? 'page' : undefined,
      onClick: event => {
        event.preventDefault();
        setExpanded('');
        setView(route);
      }
    }, h('span', null, label), detail && h('small', null, detail));
  }
  function dropdown(id, label, items) {
    const selected = items.some(item => active(item[1]));
    return h('div', {
      key: id,
      className: 'nav-dropdown' + (expanded === id ? ' is-open' : ''),
      onMouseEnter: () => {
        if (window.matchMedia('(hover: hover)').matches) setExpanded(id);
      },
      onMouseLeave: () => {
        if (!root.current?.querySelector('[data-menu="' + id + '"]')?.contains(document.activeElement)) setExpanded('');
      },
      'data-menu': id,
      onBlur: event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setExpanded('');
      }
    }, h('button', {
      type: 'button',
      className: 'nav-menu-trigger' + (selected ? ' is-current' : ''),
      'aria-expanded': expanded === id,
      'aria-controls': 'nav-menu-' + id,
      onClick: () => setExpanded(value => value === id ? '' : id),
      onKeyDown: event => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setExpanded(id);
          requestAnimationFrame(() => root.current?.querySelector('#nav-menu-' + id + ' a')?.focus());
        }
      }
    }, label, h('span', {
      className: 'nav-chevron',
      'aria-hidden': true
    }, '⌄')), h('div', {
      id: 'nav-menu-' + id,
      className: 'nav-menu-panel',
      hidden: expanded !== id
    }, items.map(([title, route, description]) => link(title, route, description))));
  }
  return h('nav', {
    ref: root,
    className: 'main-navigation refined-navigation',
    'aria-label': 'Main navigation',
    onKeyDown: event => {
      if (event.key === 'Escape') {
        const button = root.current?.querySelector('.is-open .nav-menu-trigger');
        setExpanded('');
        button?.focus();
      }
    }
  }, ...(manager ? [link('Dashboard', 'dashboard'), dropdown('orders', 'Orders', [['All orders', 'orders', 'View and manage customer orders'], ['New order', 'new', 'Create a customer request']]), link('Job Board', 'board'), link('Production Line', 'productionline'), dropdown('directory', 'Directory', [['Customers', 'customers', 'Customer records and orders'], ['Individuals', 'individuals', 'Work bookings and future availability']])] : [link('Production Line','productionline'),link('Job Board','board')]) );
}

export { Navbar };

export { Navbar as ManufacturingNavigation };
export default Navbar;
