import { IndividualJobQrDialog } from "./IndividualJobQrDialog.jsx";
import { IndividualImport } from './IndividualImport.jsx';
import { WeeklyHours } from './WeeklyHours.jsx';
import {useScreenMemory} from '../../state/useScreenMemory.js';
import { TimesheetsPage } from '../timesheets/TimesheetsPage.jsx';
// features/individuals/IndividualsPage.js
import { FormField } from "../../components/common/FormField.js";
import { availableHoursOn, bookingDates, manufacturingBookedDay, manufacturingBookingActive, manufacturingIndividualCapacity, manufacturingIsCoach, manufacturingNextAvailability } from "../../domain/workforce.js";
import { manufacturingWorkSeconds } from "../../domain/workOrders.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingDayOffset, manufacturingFinish, manufacturingToday } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";

const billingDefaults = { services: 'waiver', billing: 'piece', averageWorkingHours: 3.5 };
const serviceLabels = { waiver: 'Waiver', state: 'State' };
const billingLabels = { hourly: 'Hourly', piece: 'By piece', both: 'Both' };

function ManufacturingIndividuals() {
  const {
      setView, orders, orderDisplayTitle,
      workforce,
      saveIndividual, importIndividuals, setIndividualActive,
      saveBooking,
      releaseBooking,
      open
    } = useManufacturing(),
    h = React.createElement;
  const [timesheetPerson,setTimesheetPerson]=useScreenMemory('individuals-timesheet',null);
  const [week, setWeek] = useScreenMemory('individuals-week',manufacturingToday),
    [search, setSearch] = React.useState(''),
    [availability, setAvailability] = React.useState('all'),
    [importOpen, setImportOpen] = React.useState(false),
    [personStatus, setPersonStatus] = React.useState('active'),
    [statusChange, setStatusChange] = React.useState(null),
    [statusBusy, setStatusBusy] = React.useState(false),
    [personForm, setPersonForm] = React.useState(null),
    [qrPerson, setQrPerson] = React.useState(null),
    [personError, setPersonError] = React.useState(''),
    [personSaving, setPersonSaving] = React.useState(false),
    [bookingForm, setBookingForm] = React.useState(null),
    [selected, setSelected] = React.useState(''),
    [error, setError] = React.useState(''),
    [message, setMessage] = React.useState('');
  const today = manufacturingToday(),
    dates = Array.from({
      length: 7
    }, (_, index) => manufacturingDayOffset(week, index)),
    end = dates.at(-1),
    formatHours = value => (Math.round(value * 10) / 10).toLocaleString() + ' h',
    eligible = orders.filter(order => order.stage < 2 && order.workOrders.length),
    options = eligible.flatMap(order => order.workOrders.map(work => ({
      order,
      work
    }))),
    allActive = workforce.bookings.filter(booking => manufacturingBookingActive(booking, orders));
  const activePeople = workforce.people.filter(person => person.active !== false);
  const people = workforce.people.filter(person => personStatus === 'all' ||
    (personStatus === 'active' ? person.active !== false : person.active === false)).map(person => ({
    ...person,
    load: manufacturingIndividualCapacity(person, week, end, workforce.bookings, orders)
  })).filter(person => (person.name + ' ' + person.role).toLowerCase().includes(search.toLowerCase()) && (availability === 'all' || availability === 'available' && person.load.free > 0 || availability === 'full' && person.load.free <= .001 || availability === 'over' && person.load.over > .001)).sort((a, b) => b.load.free - a.load.free || a.name.localeCompare(b.name));
  function notify(result, success) {
    setError(result);
    if (!result) {
      setMessage(success);
      return true;
    }
    return false;
  }
  function beginBooking(personId) {
    setError('');
    setMessage('');
    const first = options[0];
    setBookingForm({
      personId: personId || activePeople[0]?.id || '',
      orderId: first?.order.id || '',
      workId: first?.work.id || '',
      start: week,
      end: week,
      hours: '',
      notes: ''
    });
  }
  function updateBooking(key, value) {
    setBookingForm(current => ({
      ...current,
      [key]: value
    }));
  }
  const field = (label, props, hint) => h(FormField, {
    key: label,
    label,
    hint
  }, h('input', props));
  const formButton = (label, handler) => h('button', {
    type: 'button',
    onClick: handler
  }, label);
  const selectedPerson = workforce.people.find(person => person.id === selected),
    selectedBookings = workforce.bookings.filter(booking => booking.personId === selected).sort((a, b) => a.start.localeCompare(b.start));
  const bookingWork = options.find(option => option.work.id === bookingForm?.workId && option.order.id === bookingForm?.orderId),
    bookingPerson = workforce.people.find(person => person.id === bookingForm?.personId),
    plannedDates = bookingForm && bookingPerson ? bookingDates(bookingPerson, bookingForm.start, bookingForm.end) : [],
    bookingDays = plannedDates.length;
  const bookingWarning = bookingDays > 0 && Number(bookingForm.hours) > 0 && plannedDates.some(date =>
    manufacturingBookedDay(bookingPerson, date, workforce.bookings.filter(item => item.id !== bookingForm.id), orders) +
      Number(bookingForm.hours) / bookingDays > availableHoursOn(bookingPerson, date) + .001);
  async function changeStatus() {
    if (!statusChange || statusBusy) return;
    setStatusBusy(true);
    const enabling = statusChange.active === false;
    try {
      if (notify(await setIndividualActive(statusChange.id, enabling), enabling ? 'Individual enabled.' : 'Individual disabled.')) setStatusChange(null);
    } finally { setStatusBusy(false); }
  }
  const personDialog = React.useRef(null);
  const editingPersonId = personForm?.id;
  React.useEffect(() => {
    if (!editingPersonId) return;
    const opener = document.activeElement;
    const dialog = personDialog.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      opener?.focus();
    };
  }, [editingPersonId]);

  function closePersonForm() {
    setPersonForm(null);
    setPersonError('');
  }
  function editPerson(person) {
    setPersonError('');
    setMessage('');
    setPersonForm({
      id: person.id,
      name: person.name,
      role: person.role ?? '',
      kind: person.kind,
      hoursPerDay: person.hoursPerDay,
      weeklyHours: person.weeklyHours,
      services: person.services ?? billingDefaults.services,
      billing: person.billing ?? billingDefaults.billing,
      averageWorkingHours: person.averageWorkingHours ?? billingDefaults.averageWorkingHours,
    });
  }
  const individualKind = personForm?.kind || (personForm && manufacturingIsCoach(personForm) ? 'coach' : 'individual');
  function updatePersonField(key, value) {
    setPersonForm(current => ({ ...current, [key]: value }));
  }
  function profileSelect(key, label, options, hint) {
    return h(FormField, { key, label, hint }, h('select', {
      value: personForm[key],
      onChange: event => updatePersonField(key, event.target.value)
    }, Object.entries(options).map(([value, text]) => h('option', { key: value, value }, text))));
  }
  const individualForm = personForm && h('form', {
    className: editingPersonId ? 'individual-edit-form' : 'panel form-panel',
    onSubmit: async event => {
      event.preventDefault();
      if (personSaving) return;
      setPersonSaving(true);
      setPersonError('');
      try {
        const problem = await saveIndividual(personForm);
        if (problem) setPersonError(problem);
        else {
          setMessage(editingPersonId ? 'Individual updated.' : 'Individual added.');
          closePersonForm();
        }
      } finally {
        setPersonSaving(false);
      }
    }
  }, h('div', {
    className: 'section-heading'
  }, h('h3', {id:'individual-form-heading'}, editingPersonId ? 'Edit individual' : 'Add individual'), !editingPersonId && h('button', {
    type: 'button',
    className: 'sample-data-button',
    onClick: () => {
      let index = 1;
      while (workforce.people.some(person => person.name === 'Demo Individual ' + index && person.id !== personForm.id)) index++;
      setPersonForm({
        ...personForm,
        name: 'Demo Individual ' + index,
        role: 'Assembly and packaging',
        hoursPerDay: 6
      });
      setPersonError('');
    }
  }, 'Fill sample data')), h('div', {
    className: 'form-grid'
  }, field('Name', {
    required: true,
    maxLength: 160,
    value: personForm.name,
    autoFocus: !!editingPersonId,
    onChange: event => setPersonForm({
      ...personForm,
      name: event.target.value
    })
  }), h(FormField, {
    label: 'Person type'
  }, h('select', {
    value: individualKind,
    onChange: event => setPersonForm({
      ...personForm,
      kind: event.target.value,
      role: event.target.value === 'coach' ? 'Job Coach' : personForm.role
    })
  }, h('option', {
    value: 'individual'
  }, 'Individual'), h('option', {
    value: 'coach'
  }, 'Job Coach'))), field('Role / skills', {
    maxLength: 240,
    value: personForm.role,
    placeholder: 'Assembly, packaging…',
    onChange: event => setPersonForm({
      ...personForm,
      role: event.target.value
    })
  }), field('Working hours per day', {
    type: 'number',
    min: .01,
    max: 24,
    step: .01,
    required: true,
    value: personForm.hoursPerDay,
    onChange: event => setPersonForm({
      ...personForm,
      hoursPerDay: event.target.value
    })
  }, 'Default for Monday–Friday if a weekly pattern is not set.'), individualKind === 'individual' && [
    profileSelect('services', 'Services', serviceLabels, 'Used for service billing.'),
    profileSelect('billing', 'Billing', billingLabels, 'Payroll method.'),
    field('Average working hours', {
      type: 'number',
      min: 0,
      max: 24,
      step: .01,
      required: true,
      value: personForm.averageWorkingHours,
      onChange: event => updatePersonField('averageWorkingHours', event.target.value)
    }, 'Billable hours per day for reporting.')
  ]), !manufacturingIsCoach(personForm) && h(WeeklyHours, {
    person:personForm,
    onChange:weeklyHours => setPersonForm(current=>({...current,weeklyHours}))
  }), personError && h('p', {role:'alert', className:'alert'}, personError), h('div', {
    className: 'form-actions'
  }, h('button', {
    type: 'button',
    disabled: personSaving,
    onClick: closePersonForm
  }, 'Cancel'), h('button', {
    className: 'primary',
    disabled: personSaving
  }, editingPersonId ? 'Save changes' : 'Save individual')));
  if(timesheetPerson!==null)return h(TimesheetsPage,{initialPerson:timesheetPerson,onBack:()=>setTimesheetPerson(null)});
  return h('div', {
    className: 'individuals-page'
  }, h('div', {
    className: 'page-heading'
  }, h('div', null, h('div', {
    className: 'eyebrow'
  }, 'OPERATIONS / INDIVIDUALS'), h('h2', null, 'People & availability'), h('p', {
    className: 'quiet'
  }, 'See booked work and remaining capacity before making future bookings.')), h('div', {
    className: 'people-heading-actions'
  }, formButton('Weekly timesheets',()=>setTimesheetPerson(selected||'')), formButton('Availability chart',()=>setView('availability')), formButton('Attendance roster',()=>setView('attendance')), formButton('Import Excel', () => setImportOpen(true)), formButton('＋ Add individual', () => {
    setPersonError('');
    setPersonForm({
      name: '',
      role: '',
      hoursPerDay: 6,
      ...billingDefaults
    });
    setError('');
    setMessage('');
  }), h('button', {
    className: 'primary',
    disabled: !activePeople.length || !options.length,
    onClick: () => beginBooking()
  }, '＋ Book work'))), h('div', {
    role: 'status',
    className: 'quiet'
  }, message), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error), qrPerson && h(IndividualJobQrDialog, {person: qrPerson, onClose: () => setQrPerson(null)}), importOpen && h(IndividualImport, {
    people: workforce.people,
    onClose: () => setImportOpen(false),
    onImport: async rows => {
      const problem = await importIndividuals(rows);
      if (!problem) setMessage(rows.length + ' individuals imported.');
      return problem;
    }
  }), statusChange && h('section', {className:'panel', 'aria-label':'Confirm individual status'},
    h('h3', null, (statusChange.active === false ? 'Enable ' : 'Disable ') + statusChange.name + '?'),
    h('p', null, statusChange.active === false ? 'This individual can receive new work again.' : 'This individual will be removed from new assignment lists. Existing records will remain available.'),
    h('div', {className:'form-actions'},
      h('button', {disabled:statusBusy, onClick:()=>setStatusChange(null)}, 'Cancel'),
      h('button', {className:'primary',disabled:statusBusy,onClick:changeStatus}, statusChange.active === false ? 'Enable individual' : 'Disable individual')
    )), individualForm && (editingPersonId ? h('dialog', {
    ref: personDialog,
    className: 'individual-edit-dialog',
    'aria-labelledby': 'individual-form-heading',
    onCancel: event => {
      event.preventDefault();
      if (!personSaving) closePersonForm();
    }
  }, individualForm) : individualForm), bookingForm && h('form', {
    className: 'panel booking-panel',
    onSubmit: async event => {
      event.preventDefault();
      if (notify(await saveBooking(bookingForm), 'Work booking saved.')) {
        setSelected(bookingForm.personId);
        setBookingForm(null);
      }
    }
  }, h('div', {
    className: 'section-heading'
  }, h('h3', null, bookingForm.id ? 'Edit work booking' : 'Book work for an individual'), h('button', {
    type: 'button',
    className: 'sample-data-button',
    disabled: !options.length || !workforce.people.length,
    onClick: () => {
      const option = options.find(item => item.work.id === bookingForm.workId) || options[0],
        person = activePeople.find(item => item.id === bookingForm.personId) || activePeople[0],
        start = manufacturingFinish(week, 1);
      setBookingForm({
        ...bookingForm,
        personId: person.id,
        orderId: option.order.id,
        workId: option.work.id,
        start,
        end: manufacturingFinish(start, 2),
        hours: Math.min(4, person.hoursPerDay * 2),
        notes: 'Demo booking for production testing.'
      });
      setPersonError('');
    }
  }, 'Fill sample data')), h('div', {
    className: 'form-grid'
  }, h(FormField, {
    label: 'Individual'
  }, h('select', {
    required: true,
    value: bookingForm.personId,
    onChange: event => updateBooking('personId', event.target.value)
  }, h('option', {
    value: ''
  }, 'Select individual'), activePeople.map(person => h('option', {
    key: person.id,
    value: person.id
  }, person.name)))), h(FormField, {
    label: 'Work order'
  }, h('select', {
    required: true,
    value: bookingForm.workId,
    onChange: event => {
      const option = options.find(item => item.work.id === event.target.value);
      setBookingForm({
        ...bookingForm,
        workId: option?.work.id || '',
        orderId: option?.order.id || ''
      });
    }
  }, h('option', {
    value: ''
  }, 'Select work order'), options.map(({
    order,
    work
  }) => h('option', {
    key: work.id,
    value: work.id
  }, orderDisplayTitle(order) + ' · ' + work.description + ' · ' + work.id)))), field('Booking start', {
    type: 'date',
    required: true,
    value: bookingForm.start,
    onChange: event => updateBooking('start', event.target.value)
  }), field('Booking end', {
    type: 'date',
    required: true,
    min: bookingForm.start,
    value: bookingForm.end,
    onChange: event => updateBooking('end', event.target.value)
  }), field('Total hours booked for this individual', {
    type: 'number',
    required: true,
    min: .01,
    step: .01,
    value: bookingForm.hours,
    onChange: event => updateBooking('hours', event.target.value)
  }, bookingDays > 0 ? 'Spread evenly across ' + bookingDays + ' working days: ' + formatHours(Number(bookingForm.hours || 0) / bookingDays) + '/day.' : 'Choose a working-day date range.'), field('Booking notes', {
    maxLength: 500,
    value: bookingForm.notes,
    onChange: event => updateBooking('notes', event.target.value)
  })), bookingWork && h('p', {
    className: 'callout'
  }, 'Work order estimate: ' + formatHours(manufacturingWorkSeconds(bookingWork.work) / 3600) + ' total labor · ' + formatHours(allActive.filter(item => item.workId === bookingWork.work.id && item.id !== bookingForm.id).reduce((sum, item) => sum + item.hours, 0)) + ' already booked across individuals.'), bookingWarning && h('p', {
    className: 'alert',
    role: 'status'
  }, 'This booking exceeds the individual’s capacity on at least one day. Adjust the dates or hours to avoid overbooking.'), h('div', {
    className: 'form-actions'
  }, formButton('Cancel', () => {
    setBookingForm(null);
    setError('');
  }), h('button', {
    className: 'primary', disabled: !bookingDays || bookingPerson?.active === false
  }, 'Save booking'))), h('section', {
    className: 'panel'
  }, h('div', {
    className: 'people-toolbar'
  }, h(FormField, {
    label: 'Period starts'
  }, h('input', {
    type: 'date',
    required: true,
    value: week,
    onChange: event => {
      if (event.target.value) setWeek(event.target.value);
    }
  })), h('div', {
    className: 'people-period-actions'
  }, formButton('← 7 days', () => setWeek(manufacturingDayOffset(week, -7))), formButton('Today', () => setWeek(today)), formButton('7 days →', () => setWeek(manufacturingDayOffset(week, 7)))), field('Search individuals', {
    type: 'search',
    value: search,
    placeholder: 'Name, role or skill…',
    onChange: event => setSearch(event.target.value)
  }), h(FormField, {label:'Status'}, h('select', {value:personStatus,onChange:event=>setPersonStatus(event.target.value)},
    h('option',{value:'active'},'Active'),h('option',{value:'disabled'},'Disabled'),h('option',{value:'all'},'All statuses'))), h(FormField, {
    label: 'Availability'
  }, h('select', {
    value: availability,
    onChange: event => setAvailability(event.target.value)
  }, [['all', 'Everyone'], ['available', 'Has free hours'], ['full', 'Fully booked'], ['over', 'Overbooked']].map(([value, label]) => h('option', {
    key: value,
    value
  }, label))))), h('p', {
    className: 'people-period-note'
  }, formatDate(week) + ' – ' + formatDate(end) + ' · Capacity follows each repeating weekly schedule. Booked hours are spread across the dates assigned when the booking was saved. Bookings stop consuming capacity after production is complete or they are released.'), !options.length && h('p', {
    className: 'callout'
  }, 'Finalize a work order on an active order to make it available for individual booking.'), workforce.people.length ? h('div', {
    className: 'capacity-scroll',
    tabIndex: 0,
    role: 'region',
    'aria-label': 'Individual workload calendar; scroll horizontally to view every day.'
  }, h('table', {
    className: 'capacity-table'
  }, h('thead', null, h('tr', null, h('th', {
    scope: 'col'
  }, 'Individual'), ...dates.map(date => h('th', {
    key: date,
    scope: 'col'
  }, new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }))), h('th', {
    scope: 'col'
  }, 'Period capacity'), h('th', {
    scope: 'col'
  }, 'Next availability'), h('th', {
    scope: 'col'
  }, 'Actions'))), h('tbody', null, people.map(person => {
    const next = manufacturingNextAvailability(person, workforce.bookings, orders, today);
    return h('tr', {
      key: person.id
    }, h('th', {
      scope: 'row'
    }, h('button', {
      className: 'text-link',
      onClick: () => setSelected(person.id)
    }, person.name), h('button', {
      className: 'text-link individual-edit-trigger',
      type: 'button',
      'aria-label': 'Edit ' + person.name,
      'aria-haspopup': 'dialog',
      onClick: () => editPerson(person)
    }, 'Edit'), person.kind === 'individual' && person.active !== false && h('button', {
      type: 'button',
      className: 'text-link individual-edit-trigger',
      'aria-label': 'Job QR for ' + person.name,
      'aria-haspopup': 'dialog',
      onClick: () => setQrPerson(person)
    }, 'Job QR'), h('small', {
      className: 'block quiet'
    }, person.role || 'No role set'), person.kind === 'individual' && h('small', {
      className: 'block quiet'
    }, serviceLabels[person.services ?? billingDefaults.services] + ' · ' +
      billingLabels[person.billing ?? billingDefaults.billing] + ' · ' +
      (person.averageWorkingHours ?? billingDefaults.averageWorkingHours) + ' billable h/day'), h('small', {
      className: 'block quiet'
    }, person.active === false ? 'Disabled' : person.weeklyHours ? 'Weekly schedule' : person.hoursPerDay + ' h/day')), ...dates.map(date => {
      const capacity = availableHoursOn(person, date),
        working = capacity > 0 || manufacturingBookedDay(person, date, workforce.bookings, orders) > 0,
        booked = manufacturingBookedDay(person, date, workforce.bookings, orders),
        free = Math.max(0, capacity - booked),
        tone = !working ? 'off' : booked > capacity + .001 ? 'over' : free < .001 ? 'full' : booked > 0 ? 'partial' : 'free';
      return h('td', {
        key: date
      }, h('div', {
        className: 'capacity-day ' + tone
      }, h('strong', null, !working ? 'Off' : formatHours(booked) + ' booked'), working && h('small', null, booked > capacity + .001 ? formatHours(booked - capacity) + ' over' : formatHours(free) + ' free')));
    }), h('td', null, h('strong', null, formatHours(person.load.booked) + ' booked'), h('small', {
      className: 'block quiet'
    }, formatHours(person.load.free) + ' available'), person.load.over > .001 && h('small', {
      className: 'people-over'
    }, formatHours(person.load.over) + ' overbooked')), h('td', null, next ? h('div', null, h('strong', null, formatDate(next.date)), h('small', {
      className: 'block quiet'
    }, formatHours(next.free) + ' free')) : 'No free hours in next 90 days'), h('td', null, h('div', {
      className: 'people-row-actions'
    }, h('button', {
      onClick: () => beginBooking(person.id),
      disabled: !options.length || person.active === false
    }, 'Book work'), formButton('View bookings', () => setSelected(person.id)), !manufacturingIsCoach(person) && formButton(person.active === false ? 'Enable' : 'Disable', () => setStatusChange(person)))));
  })))) : h('div', {
    className: 'empty'
  }, 'Add individuals to start planning workload and availability.'), workforce.people.length > 0 && !people.length && h('p', {
    className: 'empty'
  }, 'No individuals match your filters.')), selectedPerson && h('section', {
    className: 'panel'
  }, h('div', {
    className: 'section-heading'
  }, h('div', null, h('h3', null, selectedPerson.name + ' — booked work'), h('p', {
    className: 'quiet'
  }, 'All bookings, including past and released work.')), formButton('Close', () => setSelected(''))), selectedBookings.length ? h('div', {
    className: 'person-booking-list'
  }, selectedBookings.map(booking => {
    const order = orders.find(item => item.id === booking.orderId),
      work = order?.workOrders.find(item => item.id === booking.workId),
      active = manufacturingBookingActive(booking, orders);
    return h('article', {
      key: booking.id,
      className: 'person-booking'
    }, h('div', null, h('strong', null, order ? orderDisplayTitle(order) : booking.orderId), h('p', null, (work?.description || booking.workId) + ' · ' + formatHours(booking.hours)), h('small', null, formatDate(booking.start) + ' – ' + formatDate(booking.end)), booking.notes && h('p', {
      className: 'quiet'
    }, booking.notes)), h('div', {
      className: 'people-row-actions'
    }, h('span', {
      className: 'badge ' + (active ? '' : 'green')
    }, booking.status === 'released' ? 'Released' : active ? booking.end < today ? 'Past booking' : 'Booked' : 'Production complete'), order && formButton('Open order', () => open(order.id)), active && formButton('Edit booking', () => {
      setBookingForm({
        ...booking
      });
      setError('');
    }), active && formButton('Release booking', async () => notify(await releaseBooking(booking.id), 'Booking released.'))));
  })) : h('p', {
    className: 'empty'
  }, 'No bookings for this individual.')));
}

export { ManufacturingIndividuals };
