// domain/workforce.js
import { manufacturingDate, manufacturingDayOffset, manufacturingWeekdays } from "../utils/dates.js";

function manufacturingIsCoach(person) {
  return person.kind === 'coach' || /job\s*coach/i.test(person.role || '');
}
function manufacturingBookingActive(booking, orders) {
  return booking.status !== 'released' && orders.some(order => order.id === booking.orderId && order.stage < 2 && order.workOrders.some(work => work.id === booking.workId && !(work.boxes || []).some(box => box.id === booking.id && (box.completedAt || box.status === 'completed'))));
}
function weeklyAvailability(person) {
  return Array.isArray(person.weeklyHours) && person.weeklyHours.length === 7
    ? person.weeklyHours.map(Number)
    : [1, 2, 3, 4, 5, 6, 7].map(day => day <= 5 ? Number(person.hoursPerDay || 6) : 0);
}
function availableHoursOn(person, date) {
  const day = manufacturingDate(date)?.getUTCDay();
  return person.active === false || day === undefined ? 0 : weeklyAvailability(person)[(day + 6) % 7];
}
function bookingDates(person, start, end) {
  const count = Math.round((manufacturingDate(end) - manufacturingDate(start)) / 86400000) + 1;
  if (!start || !end || count < 1 || count > 3660) return [];
  return Array.from({length:count}, (_, i) => manufacturingDayOffset(start, i)).filter(date => availableHoursOn(person, date) > 0);
}
function manufacturingBookedDay(person, date, bookings, orders) {
  return bookings.filter(booking => booking.personId === person.id && manufacturingBookingActive(booking, orders) && booking.start <= date && booking.end >= date)
    .reduce((sum, booking) => {
      const days = booking.allocatedDates;
      if (Array.isArray(days)) return days.includes(date) ? sum + booking.hours / days.length : sum;
      return manufacturingWeekdays(date, date) ? sum + booking.hours / Math.max(1, manufacturingWeekdays(booking.start, booking.end)) : sum;
    }, 0);
}
function manufacturingIndividualCapacity(person, start, end, bookings, orders) {
  let booked = 0,
    free = 0,
    over = 0,
    capacity = 0;
  for (let date = start; date && date <= end; date = manufacturingDayOffset(date, 1)) {
    const available = availableHoursOn(person, date);
    capacity += available;
    const hours = manufacturingBookedDay(person, date, bookings, orders);
    booked += hours;
    free += Math.max(0, available - hours);
    over += Math.max(0, hours - available);
  }
  return {
    booked,
    free,
    over,
    capacity
  };
}
function manufacturingNextAvailability(person, bookings, orders, start) {
  for (let offset = 0; offset < 90; offset++) {
    const date = manufacturingDayOffset(start, offset);
    if (availableHoursOn(person, date) > 0) {
      const free = availableHoursOn(person, date) - manufacturingBookedDay(person, date, bookings, orders);
      if (free > .001) return {
        date,
        free
      };
    }
  }
  return null;
}

export { weeklyAvailability, availableHoursOn, bookingDates, manufacturingIsCoach, manufacturingBookingActive, manufacturingBookedDay, manufacturingIndividualCapacity, manufacturingNextAvailability };
