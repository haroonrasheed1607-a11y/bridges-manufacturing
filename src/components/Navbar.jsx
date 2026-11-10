import { canUsePlan, isShopFloorRole } from '../features/auth/permissions.js';
// components/layout/Navigation.js
import { useManufacturing } from "../state/ManufacturingContext.jsx";
import { React } from "../vendor/react-runtime.js";

function Navbar() {
  const {
      setView,
      view, manager, profile
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
  const active = route => route === 'board' ? ['board', 'orders', 'new', 'detail'].includes(view) : route === view;
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
  const plan = canUsePlan(profile?.role) ? [link('Plan','plan')] : [];
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
  }, ...(manager ? [link('Dashboard', 'dashboard'), link('Job Board', 'board'), ...plan, link('Shop Floor', 'productionline'), dropdown('directory', 'Directory', [['Clients', 'customers', 'Register clients and their items'], ['Individuals', 'individuals', 'Work bookings and future availability'], ['Availability','availability','Reported weekly and monthly availability'], ['Attendance','attendance','Daily attendance roster'], ...(profile?.role==='admin' ? [['Users', 'users', 'Staff accounts and password management']] : [])]), ...(profile?.role==='admin' ? [link('Configurations','configurations')] : [])] : isShopFloorRole(profile?.role) ? [link(profile.role==='box_setup'?'Box Setup':'Scan & Complete','productionline'),...plan] : [link('Shop Floor','productionline'),...plan,link('Job Board','board'),...(profile?.role==='coach'?[link('Availability','availability'),link('Attendance','attendance')]:[])]) );
}

export { Navbar };

export { Navbar as ManufacturingNavigation };
export default Navbar;
