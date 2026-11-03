// state/useWorkforce.js
import { STORAGE_KEY } from "../config/storage.js";
import { manufacturingWeekdays } from "../utils/dates.js";
import { createId } from "../utils/ids.js";
import { React } from "../vendor/react-runtime.js";
import { manufacturingLoadWorkforce } from "./storage.js";

function useManufacturingWorkforce(orders) {
  const [workforce, setWorkforce] = React.useState(manufacturingLoadWorkforce);
  function commit(next) {
    try {
      localStorage.setItem(STORAGE_KEY + '-workforce', JSON.stringify(next));
      setWorkforce(next);
      return '';
    } catch {
      return 'Unable to save. Browser storage is unavailable or full.';
    }
  }
  function saveIndividual(value) {
    const name = value.name.trim(),
      hoursPerDay = Number(value.hoursPerDay);
    if (!name) return 'Enter a name.';
    if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0 || hoursPerDay > 24) return 'Working hours must be greater than zero and at most 24.';
    if (workforce.people.some(person => person.id !== value.id && person.name.toLowerCase() === name.toLowerCase())) return 'An individual with this name already exists.';
    const person = {
      id: value.id || createId('PERSON'),
      name,
      role: value.role.trim(),
      kind: value.kind === 'coach' || !value.kind && /job\s*coach/i.test(value.role) ? 'coach' : 'individual',
      hoursPerDay
    };
    return commit({
      ...workforce,
      people: value.id ? workforce.people.map(item => item.id === value.id ? person : item) : [...workforce.people, person]
    });
  }
  function saveBooking(value) {
    const person = workforce.people.find(item => item.id === value.personId),
      order = orders.find(item => item.id === value.orderId),
      work = order?.workOrders.find(item => item.id === value.workId),
      hours = Number(value.hours);
    if (!person || !work || order.stage > 1) return 'Choose an individual and a work order awaiting or in production.';
    if (!value.start || !value.end || value.end < value.start || !manufacturingWeekdays(value.start, value.end)) return 'Choose a date range containing at least one working day.';
    if (!Number.isFinite(hours) || hours <= 0) return 'Enter a positive number of booked hours.';
    const booking = {
      id: value.id || createId('BOOK'),
      personId: person.id,
      orderId: order.id,
      workId: work.id,
      start: value.start,
      end: value.end,
      hours,
      notes: (value.notes || '').trim(),
      status: 'booked'
    };
    return commit({
      ...workforce,
      bookings: workforce.bookings.some(item => item.id === booking.id) ? workforce.bookings.map(item => item.id === booking.id ? booking : item) : [...workforce.bookings, booking]
    });
  }
  function releaseBooking(id) {
    return commit({
      ...workforce,
      bookings: workforce.bookings.map(item => item.id === id ? {
        ...item,
        status: 'released'
      } : item)
    });
  }
  return {
    workforce,
    saveIndividual,
    saveBooking,
    releaseBooking
  };
}

export { useManufacturingWorkforce };
