// features/dashboard/DashboardPage.js
import { manufacturingBoardStage, manufacturingBoardStages } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingDashboard() {
  const {
      orders,
      setView
    } = useManufacturing(),
    h = React.createElement;
  const metrics = [['Active orders', orders.filter(o => o.stage < 6).length], ['In production', orders.filter(o => o.stage === 1).length], ['Quality & packing', orders.filter(o => [2, 3].includes(o.stage)).length], ['Completed', orders.filter(o => o.stage === 6).length]];
  return h(React.Fragment, null, h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, 'OPERATIONS / DASHBOARD'), h('h2', null, 'Dashboard'), h('p', {
    className: 'quiet'
  }, 'An overview of manufacturing operations.')), h('button', {
    className: 'primary',
    onClick: () => setView('orders')
  }, 'View orders →')), h('div', {
    className: 'metrics'
  }, metrics.map(([label, value]) => h('div', {
    key: label
  }, h('span', null, label), h('strong', null, value)))), h('section', {
    className: 'panel'
  }, h('h3', null, 'Orders by stage'), h('div', {
    className: 'table-wrap'
  }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Stage'), h('th', null, 'Orders'))), h('tbody', null, manufacturingBoardStages.map((label, index) => h('tr', {
    key: label
  }, h('td', null, label), h('td', null, orders.filter(o => manufacturingBoardStage(o) === index).length))))))));
}

export { ManufacturingDashboard };
