import { productionTabs } from '../auth/permissions.js';
// features/production/ProductionLinePage.js
import { FormField } from "../../components/common/FormField.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";
import { ManufacturingProductionBoxes } from "./BoxAssignment.js";
import { ManufacturingScanComplete } from "./ScanComplete.js";

function ManufacturingProductionLine() {
  const {
      orders, profile,
      change
    } = useManufacturing(),
    h = React.createElement,
    [selectedTab, setTab] = React.useState(() => productionTabs(profile?.role)[0]?.[0] || 'scan'),
    [orderId, setOrderId] = React.useState('');
  const activeOrders = orders.filter(order => order.stage === 1 && order.workOrders.length),
    order = activeOrders.find(item => item.id === orderId) || activeOrders[0];
  const tabs = productionTabs(profile?.role);
  if (!tabs.length) return h('p', {role:'alert'}, 'Production access required.');
  const tab = tabs.some(([value]) => value === selectedTab) ? selectedTab : tabs[0][0];
  function selectTab(value) {
    setTab(value);
  }
  return h('div', {
    className: 'production-line-workspace'
  }, h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, 'PRODUCTION LINE'), h('h2', null, profile?.role === 'box_setup' ? 'Box setup' : profile?.role === 'box_scanner' ? 'Scan & complete work' : 'Production line'), h('p', {
    className: 'quiet'
  }, profile?.role === 'box_setup' ? 'Assign individuals and print labels for new boxes.' : profile?.role === 'box_scanner' ? 'Scan a box, confirm the completed pieces and mark it complete.' : 'Complete finished work or prepare and print box labels.'))), h('div', {
    className: 'production-mode-tabs',
    role: 'tablist',
    'aria-label': 'Production line tasks'
  }, tabs.map(([value, label], index) => h('button', {
    key: value,
    id: 'production-tab-' + value,
    type: 'button',
    role: 'tab',
    'aria-selected': tab === value,
    'aria-controls': 'production-panel-' + value,
    tabIndex: tab === value ? 0 : -1,
    className: tab === value ? 'is-selected' : '',
    onClick: () => selectTab(value),
    onKeyDown: event => {
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
      event.preventDefault();
      const next = key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 : key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
      selectTab(tabs[next][0]);
      event.currentTarget.parentElement.querySelector('#production-tab-' + tabs[next][0])?.focus();
    }
  }, label))), h('div', {
    id: 'production-panel-' + tab,
    role: 'tabpanel',
    'aria-labelledby': 'production-tab-' + tab,
    key: tab
  }, tab === 'scan' ? h(ManufacturingScanComplete) : h(React.Fragment, null, h('section', {
    className: 'panel'
  }, h('h3', null, 'Generate printouts for boxes'), h('p', {
    className: 'quiet'
  }, 'Choose an order in production, then select a work order and sub-job, assign an individual and print the box label. Existing labels can also be reprinted.'), activeOrders.length ? h(FormField, {
    label: 'Production order'
  }, h('select', {
    value: order.id,
    onChange: event => setOrderId(event.target.value)
  }, activeOrders.map(item => h('option', {
    key: item.id,
    value: item.id
  }, item.title + ' · ' + item.customer + ' · ' + item.id)))) : h('p', {
    className: 'empty'
  }, 'No orders are in production. Start production on a work order to create box labels.')), order && h(ManufacturingProductionBoxes, {
    key: order.id,
    productionOrder: order,
    onUpdateWork: (workId, updater, message) => change(order.id, current => ({
      ...current,
      workOrders: current.workOrders.map(work => work.id === workId ? updater(work) : work)
    }), message)
  }))));
}

export { ManufacturingProductionLine };
