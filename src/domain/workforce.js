// domain/workforce.js
import { manufacturingDate, manufacturingDayOffset, manufacturingWeekdays } from "../utils/dates.js";

function manufacturingIsCoach(person) {
  return person.kind === 'coach' || /job\s*coach/i.test(person.role || '');
}
function manufacturingBookingActive(booking, orders) {
  return booking.status !== 'released' && orders.some(order => order.id === booking.orderId && order.stage < 2 && order.workOrders.some(work => work.id === booking.workId && !(work.boxes || []).some(box => box.id === booking.id && (box.completedAt || box.status === 'completed'))));
}
function manufacturingBookedDay(person, date, bookings, orders) {
  const day = manufacturingDate(date)?.getUTCDay();
  if (day === 0 || day === 6) return 0;
  return bookings.filter(booking => booking.personId === person.id && manufacturingBookingActive(booking, orders) && booking.start <= date && booking.end >= date).reduce((sum, booking) => sum + booking.hours / Math.max(1, manufacturingWeekdays(booking.start, booking.end)), 0);
}
function manufacturingIndividualCapacity(person, start, end, bookings, orders) {
  let booked = 0,
    free = 0,
    over = 0,
    days = 0;
  for (let date = start; date && date <= end; date = manufacturingDayOffset(date, 1)) {
    if (!manufacturingWeekdays(date, date)) continue;
    days++;
    const hours = manufacturingBookedDay(person, date, bookings, orders);
    booked += hours;
    free += Math.max(0, person.hoursPerDay - hours);
    over += Math.max(0, hours - person.hoursPerDay);
  }
  return {
    booked,
    free,
    over,
    capacity: days * person.hoursPerDay
  };
}
function manufacturingNextAvailability(person, bookings, orders, start) {
  for (let offset = 0; offset < 90; offset++) {
    const date = manufacturingDayOffset(start, offset);
    if (manufacturingWeekdays(date, date)) {
      const free = person.hoursPerDay - manufacturingBookedDay(person, date, bookings, orders);
      if (free > .001) return {
        date,
        free
      };
    }
  }
  return null;
}

export { manufacturingIsCoach, manufacturingBookingActive, manufacturingBookedDay, manufacturingIndividualCapacity, manufacturingNextAvailability };
