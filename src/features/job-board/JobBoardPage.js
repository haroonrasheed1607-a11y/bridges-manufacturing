import {JobCompletion} from "../../components/common/JobCompletion.js";
// features/job-board/JobBoardPage.js
import { manufacturingColumnProgress } from "../../domain/boardProgress.js";
import { manufacturingOrderPlan, manufacturingRepeatDays } from "../../domain/orders.js";
import { manufacturingBoardStage, manufacturingBoardStages, manufacturingNextOrderState, manufacturingOrderStep, manufacturingTransitionLabel, manufacturingWorkflowBlock } from "../../domain/workflow.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";
import { canQuickApproveWorkOrder, QuickApproveWorkOrder } from "../work-orders/QuickApproveWorkOrder.jsx";
import { ManufacturingBoardActions } from "./JobActionsDialog.js";

function ManufacturingJobBoard() {
  const {
      orders,
      orderDisplayTitle,
      open,
      setView,
      change,
      workforce, manager
    } = useManufacturing(),
    h = React.createElement;
  const [search, setSearch] = React.useState(''),
    [filter, setFilter] = React.useState('all'),
    [customer, setCustomer] = React.useState('all'),
    [selectedOrderId, setSelectedOrderId] = React.useState('');
  const selectedOrder = orders.find(order => order.id === selectedOrderId);
  const today = manufacturingToday(),
    late = order => order.stage < 6 && !!order.required && order.required < today;
  const customers = [...new Set(orders.map(order => order.customer))].sort();
  const visible = orders.filter(order => {
    const text = [order.id, order.orderNumber, orderDisplayTitle(order), order.customer, ...order.workOrders.flatMap(work => [work.id, work.description, work.type])].join(' ').toLowerCase();
    return text.includes(search.toLowerCase()) && (customer === 'all' || order.customer === customer) && (filter === 'all' || filter === 'active' && order.stage < 6 || filter === 'late' && late(order) || filter === 'completed' && order.stage === 6 || filter === 'repeat' && !!manufacturingRepeatDays(order.frequency, order.repeatEveryDays));
  }).sort((a, b) => (a.required || '9999').localeCompare(b.required || '9999'));
  async function advance(order) {
    if (manufacturingWorkflowBlock(order, workforce)) return;
    return change(order.id, manufacturingNextOrderState, manufacturingTransitionLabel(order) + '.');
  }
  function card(order) {
    const plan = manufacturingOrderPlan(order),
      jobs = order.workOrders.flatMap(work => work.jobs || []),
      blocked = manufacturingWorkflowBlock(order, workforce),
      coaches = [...new Set(order.workOrders.map(work => work.coachName).filter(Boolean))],
      types = [...new Set(order.workOrders.map(work => work.type))];
    function activate() {
      if (manager && order.stage < 6 && !blocked) setSelectedOrderId(order.id);else open(order.id);
    }
    const details = h('article', {
      key: order.id,
      className: 'job-card compact-job-card' + (late(order) ? ' job-card-late' : ''),
      role: 'button',
      tabIndex: 0,
      'aria-label': orderDisplayTitle(order) + ' · ' + order.customer + ' · ' + (manager && order.stage < 6 && !blocked ? 'Show order actions' : 'Open order details'),
      'aria-haspopup': manager && order.stage < 6 && !blocked ? 'dialog' : undefined,
      onClick: activate,
      onKeyDown: event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      }
    }, h('div', {
      className: 'job-card-top'
    }, h('span', {
      className: 'job-order-id'
    }, 'System ID: ' + order.id), late(order) ? h('span', {
      className: 'badge red'
    }, 'Overdue') : order.stage === 6 ? h('span', {
      className: 'badge green'
    }, 'Completed') : order.expected && order.required && order.expected > order.required ? h('span', {
      className: 'badge amber'
    }, 'Forecast late') : null), h('h4', {
      className: 'compact-job-title',
      title: orderDisplayTitle(order)
    }, orderDisplayTitle(order)), h('p', {
      className: 'job-customer',
      title: order.customer
    }, order.customer), order.orderNumber && h('p', {
      className: 'job-customer',
      title: order.orderNumber
    }, 'Order number: ' + order.orderNumber), h(JobCompletion,{order}), h('div', {
      className: 'compact-job-quantities'
    }, h('strong', null, plan.quantity.toLocaleString() + ' pcs'), h('span', null, plan.packCount.toLocaleString() + ' packs × ' + plan.perPack)), h('div', {
      className: 'compact-job-dates'
    }, h('span', null, 'Due ', h('strong', null, formatDate(order.required))), h('span', null, 'Est. ' + (order.expected ? formatDate(order.expected) : 'Pending'))), h('div', {
      className: 'compact-job-meta'
    }, h('span', null, order.workOrders.length + ' WO · ' + jobs.length + ' sub-jobs'), h('span', null, types.join(' / ') || 'New request')), h('p', {
      className: 'compact-job-coach',
      title: coaches.join(', ')
    }, 'Coach: ' + (coaches.join(', ') || 'Unassigned')), h('div', {
      className: 'compact-job-footer'
    }, h('span', null, manufacturingRepeatDays(order.frequency, order.repeatEveryDays) ? '↻ Every ' + manufacturingRepeatDays(order.frequency, order.repeatEveryDays) + ' days' : 'One time'), h('span', {
      className: blocked ? 'compact-job-held' : 'compact-job-ready',
      title: order.stage === 6 ? 'Order completed' : blocked || manufacturingTransitionLabel(order)
    }, order.stage === 6 ? 'Complete' : blocked ? manufacturingOrderStep(order) : 'Ready ···')));
    return manager && canQuickApproveWorkOrder(order)
      ? h('div', { key: order.id, className: 'job-request-card' }, details, h(QuickApproveWorkOrder, { order }))
      : details;
  }
  return h('div', {
    className: 'job-board-page'
  }, h('div', {
    className: 'page-heading'
  }, h('h2', null, 'Job Board'), manager && h('div', {
    className: 'job-board-heading-actions'
  }, h('button', {
    type: 'button',
    onClick: () => setView('orders')
  }, 'List view'), h('button', {
    type: 'button',
    className: 'primary',
    onClick: () => setView('new')
  }, '＋ New order request'))), h('div', {
    className: 'job-board-toolbar'
  }, h('label', {
    className: 'field job-board-search'
  }, h('span', null, 'Search jobs'), h('input', {
    type: 'search',
    value: search,
    placeholder: 'Order, customer, work order…',
    onChange: event => setSearch(event.target.value)
  })), h('label', {
    className: 'field'
  }, h('span', null, 'Customer'), h('select', {
    value: customer,
    onChange: event => setCustomer(event.target.value)
  }, h('option', {
    value: 'all'
  }, 'All customers'), customers.map(name => h('option', {
    key: name,
    value: name
  }, name)))), h('label', {
    className: 'field'
  }, h('span', null, 'Show'), h('select', {
    value: filter,
    onChange: event => setFilter(event.target.value)
  }, [['all', 'All orders'], ['active', 'Active orders'], ['late', 'Overdue'], ['repeat', 'Repeat orders'], ['completed', 'Completed']].map(([value, label]) => h('option', {
    key: value,
    value
  }, label))))), h('div', {
    className: 'job-board-caption'
  }, h('span', {
    role: 'status'
  }, visible.length + ' of ' + orders.length + ' orders'), h('span', null, 'Bars show orders acted upon vs pending at each stage · Scroll sideways →')), h('div', {
    className: 'job-board-scroll',
    tabIndex: 0,
    role: 'region',
    'aria-label': 'Job board. Scroll horizontally through the six stages.'
  }, h('div', {
    className: 'job-board-columns'
  }, manufacturingBoardStages.map((label, index) => {
    const group = visible.filter(order => manufacturingBoardStage(order) === index),
      total = orders.filter(order => manufacturingBoardStage(order) === index).length,
      progress = manufacturingColumnProgress(visible, index);
    return h('section', {
      key: label,
      className: 'job-board-column',
      'aria-label': label
    }, h('header', {
      className: 'job-column-heading'
    }, h('span', {
      className: 'job-stage-number'
    }, String(index + 1).padStart(2, '0')), h('h3', null, label), h('progress', {
      className: 'job-column-progress',
      max: 100,
      value: progress.percent,
      'aria-label': label + ' action progress: ' + progress.acted + ' done, ' + progress.pending + ' pending',
      'aria-valuetext': progress.percent + '% acted upon',
      title: progress.percent + '% · ' + progress.acted + ' orders acted upon · ' + progress.pending + ' pending. Orders not yet at this stage are excluded.'
    }), h('span', {
      className: 'job-column-count',
      title: total + ' total orders in this stage'
    }, group.length)), h('div', {
      className: 'job-column-action-summary'
    }, h('span', null, progress.pending + ' pending'), h('span', null, progress.acted + ' done')), h('div', {
      className: 'job-column-cards'
    }, group.length ? group.map(card) : h('div', {
      className: 'job-column-empty'
    }, total ? 'No matching orders' : 'No orders in this stage')));
  }))), selectedOrder && h(ManufacturingBoardActions, {
    order: selectedOrder,
    onClose: () => setSelectedOrderId(''),
    onAdvance: advance
  }), !visible.length && h('p', {
    className: 'empty'
  }, orders.length ? 'No matching orders. Adjust the search or filters.' : 'Create your first order to start the job board.'));
}

export { ManufacturingJobBoard };
