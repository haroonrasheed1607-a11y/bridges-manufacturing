import { TimesheetsPage } from '../timesheets/TimesheetsPage.jsx';
// features/individuals/IndividualsPage.js
import { FormField } from "../../components/common/FormField.js";
import { manufacturingBookedDay, manufacturingBookingActive, manufacturingIndividualCapacity, manufacturingIsCoach, manufacturingNextAvailability } from "../../domain/workforce.js";
import { manufacturingWorkSeconds } from "../../domain/workOrders.js";
import { useManufacturing } from "../../state/ManufacturingContext.jsx";
import { formatDate, manufacturingDate, manufacturingDayOffset, manufacturingFinish, manufacturingToday, manufacturingWeekdays } from "../../utils/dates.js";
import { React } from "../../vendor/react-runtime.js";

function ManufacturingIndividuals() {
  const {
      orders,
      workforce,
      saveIndividual,
      saveBooking,
      releaseBooking,
      open
    } = useManufacturing(),
    h = React.createElement;
  const [timesheetPerson,setTimesheetPerson]=React.useState(null);
  const [week, setWeek] = React.useState(manufacturingToday),
    [search, setSearch] = React.useState(''),
    [availability, setAvailability] = React.useState('all'),
    [personForm, setPersonForm] = React.useState(null),
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
  const people = workforce.people.map(person => ({
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
      personId: personId || workforce.people[0]?.id || '',
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
    bookingDays = bookingForm ? manufacturingWeekdays(bookingForm.start, bookingForm.end) : 0;
  const bookingWarning = bookingForm && bookingPerson && bookingDays > 0 && Number(bookingForm.hours) > 0 ? Array.from({
    length: Math.min(3660, Math.max(0, Math.round((manufacturingDate(bookingForm.end) - manufacturingDate(bookingForm.start)) / 86400000) + 1))
  }, (_, index) => manufacturingDayOffset(bookingForm.start, index)).some(date => manufacturingWeekdays(date, date) && manufacturingBookedDay(bookingPerson, date, workforce.bookings.filter(item => item.id !== bookingForm.id), orders) + Number(bookingForm.hours) / bookingDays > bookingPerson.hoursPerDay + .001) : false;
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
  }, formButton('Weekly timesheets',()=>setTimesheetPerson(selected||'')), formButton('＋ Add individual', () => {
    setPersonForm({
      name: '',
      role: '',
      hoursPerDay: 6
    });
    setError('');
    setMessage('');
  }), h('button', {
    className: 'primary',
    disabled: !workforce.people.length || !options.length,
    onClick: () => beginBooking()
  }, '＋ Book work'))), h('div', {
    role: 'status',
    className: 'quiet'
  }, message), error && h('p', {
    role: 'alert',
    className: 'alert'
  }, error), personForm && h('form', {
    className: 'panel form-panel',
    onSubmit: async event => {
      event.preventDefault();
      if (notify(await saveIndividual(personForm), personForm.id ? 'Individual updated.' : 'Individual added.')) setPersonForm(null);
    }
  }, h('div', {
    className: 'section-heading'
  }, h('h3', null, personForm.id ? 'Edit individual' : 'Add individual'), h('button', {
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
      setError('');
    }
  }, 'Fill sample data')), h('div', {
    className: 'form-grid'
  }, field('Name', {
    required: true,
    maxLength: 160,
    value: personForm.name,
    onChange: event => setPersonForm({
      ...personForm,
      name: event.target.value
    })
  }), h(FormField, {
    label: 'Person type'
  }, h('select', {
    value: personForm.kind || (manufacturingIsCoach(personForm) ? 'coach' : 'individual'),
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
  }, 'Monday–Friday. Default: 6 hours.')), h('div', {
    className: 'form-actions'
  }, formButton('Cancel', () => {
    setPersonForm(null);
    setError('');
  }), h('button', {
    className: 'primary'
  }, 'Save individual'))), bookingForm && h('form', {
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
        person = workforce.people.find(item => item.id === bookingForm.personId) || workforce.people[0],
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
      setError('');
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
  }, 'Select individual'), workforce.people.map(person => h('option', {
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
  }, order.title + ' · ' + work.description + ' · ' + work.id)))), field('Booking start', {
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
    className: 'primary'
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
  }), h(FormField, {
    label: 'Availability'
  }, h('select', {
    value: availability,
    onChange: event => setAvailability(event.target.value)
  }, [['all', 'Everyone'], ['available', 'Has free hours'], ['full', 'Fully booked'], ['over', 'Overbooked']].map(([value, label]) => h('option', {
    key: value,
    value
  }, label))))), h('p', {
    className: 'people-period-note'
  }, formatDate(week) + ' – ' + formatDate(end) + ' · Monday–Friday capacity. Booked hours are distributed evenly across each booking’s working days. Bookings stop consuming capacity after production is complete or they are released.'), !options.length && h('p', {
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
    }, person.name), h('small', {
      className: 'block quiet'
    }, person.role || 'No role set'), h('small', {
      className: 'block quiet'
    }, person.hoursPerDay + ' h/day')), ...dates.map(date => {
      const working = manufacturingWeekdays(date, date),
        booked = manufacturingBookedDay(person, date, workforce.bookings, orders),
        free = Math.max(0, person.hoursPerDay - booked),
        tone = !working ? 'off' : booked > person.hoursPerDay + .001 ? 'over' : free < .001 ? 'full' : booked > 0 ? 'partial' : 'free';
      return h('td', {
        key: date
      }, h('div', {
        className: 'capacity-day ' + tone
      }, h('strong', null, !working ? 'Off' : formatHours(booked) + ' booked'), working && h('small', null, booked > person.hoursPerDay + .001 ? formatHours(booked - person.hoursPerDay) + ' over' : formatHours(free) + ' free')));
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
      disabled: !options.length
    }, 'Book work'), formButton('View bookings', () => setSelected(person.id)), formButton('Edit', () => {
      setPersonForm({
        ...person
      });
      setError('');
    }))));
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
    }, h('div', null, h('strong', null, order?.title || booking.orderId), h('p', null, (work?.description || booking.workId) + ' · ' + formatHours(booking.hours)), h('small', null, formatDate(booking.start) + ' – ' + formatDate(booking.end)), booking.notes && h('p', {
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
