// features/work-orders/AssignWorkOrder.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingIsCoach } from "../../domain/workforce.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingAssignWorkOrder() {
  const {
      order,
      workforce,
      change,
      setView,
      saveIndividual
    } = useManufacturing(),
    h = React.createElement,
    [error, setError] = React.useState(''),
    [coachName, setCoachName] = React.useState('');
  const coaches = workforce.people.filter(manufacturingIsCoach),
    ready = order.workOrders.length > 0 && order.workOrders.every(work => coaches.some(coach => coach.id === work.coachId));
  function assign(workId, coachId) {
    const coach = coaches.find(person => person.id === coachId);
    change(order.id, current => ({
      ...current,
      assignmentConfirmedAt: null,
      workOrders: current.workOrders.map(work => work.id === workId ? {
        ...work,
        coachId: coach?.id || null,
        coachName: coach?.name || ''
      } : work)
    }), 'Job Coach assignment updated.');
  }
  function confirm() {
    if (!ready) {
      setError('Assign a Job Coach to every work order.');
      return;
    }
    change(order.id, current => ({
      ...current,
      assignmentConfirmedAt: new Date().toISOString()
    }), 'Work orders assigned to Job Coaches. Ready to start production.');
    setError('');
  }
  return h('section', null, h('div', {
    className: 'section-heading'
  }, h('div', null, h('h3', null, order.assignmentConfirmedAt ? 'Start production' : 'Assign Job Coaches'), h('p', {
    className: 'quiet'
  }, 'Assign each work order to a Job Coach. Boxes are assigned to individuals during production.')), h('button', {
    onClick: () => setView('individuals')
  }, 'People directory')), h('div', {
    className: 'coach-add'
  }, h('label', {
    className: 'field'
  }, h('span', null, 'Add a Job Coach'), h('input', {
    value: coachName,
    maxLength: 160,
    placeholder: 'Coach name',
    onChange: event => setCoachName(event.target.value)
  })), h('button', {
    type: 'button',
    onClick: async () => {
      const problem = await saveIndividual({
        name: coachName,
        role: 'Job Coach',
        kind: 'coach',
        hoursPerDay: 6
      });
      setError(problem);
      if (!problem) setCoachName('');
    }
  }, 'Add Job Coach')), order.workOrders.map(work => h('article', {
    key: work.id,
    className: 'assignment-work'
  }, h('h4', null, work.description), h('p', {
    className: 'quiet'
  }, work.id + ' · ' + work.quantity + ' pieces'), h(FormField, {
    label: 'Job Coach'
  }, h('select', {
    value: work.coachId || '',
    onChange: event => assign(work.id, event.target.value)
  }, h('option', {
    value: ''
  }, 'Select Job Coach'), coaches.map(coach => h('option', {
    key: coach.id,
    value: coach.id
  }, coach.name)))))), !coaches.length && h('p', {
    className: 'callout'
  }, 'Add a Job Coach above or in the people directory.'), !order.assignmentConfirmedAt && h('div', {
    className: 'form-actions'
  }, h('button', {
    className: 'primary',
    disabled: !ready,
    onClick: confirm
  }, 'Confirm Job Coach assignments')), order.assignmentConfirmedAt && h('p', {
    className: 'callout'
  }, 'Job Coaches confirmed. Use Start production to begin.'), error && h('p', {
    className: 'alert',
    role: 'alert'
  }, error));
}

export { ManufacturingAssignWorkOrder };
