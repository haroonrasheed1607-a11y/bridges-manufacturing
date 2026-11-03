// domain/orders.js
import { manufacturingFinish, manufacturingToday, manufacturingWeekdays } from "../utils/dates.js";

function manufacturingOrderPlan(order) {
  const quantity = Number(order.quantity ?? order.workOrders?.reduce((sum, work) => sum + work.quantity, 0) ?? 0),
    perPack = Number(order.perPack ?? order.workOrders?.[0]?.perPack ?? 25),
    seconds = Number(order.seconds ?? 30),
    hoursPerDay = Number(order.hoursPerDay ?? 6),
    startDate = order.startDate || manufacturingToday(),
    availableDays = manufacturingWeekdays(startDate, order.required || startDate),
    laborHours = quantity * seconds / 3600;
  const recommendedPeople = laborHours > 0 && hoursPerDay > 0 ? Math.max(1, Math.ceil(laborHours / (Math.max(1, availableDays) * hoursPerDay))) : 0,
    people = Number(order.assignedPeople) || recommendedPeople,
    workingDays = people > 0 && hoursPerDay > 0 ? Math.ceil(laborHours / (people * hoursPerDay)) : 0;
  return {
    quantity,
    perPack,
    seconds,
    hoursPerDay,
    startDate,
    availableDays,
    laborHours,
    recommendedPeople,
    people,
    workingDays,
    packCount: perPack > 0 ? Math.ceil(quantity / perPack) : 0,
    expected: manufacturingFinish(startDate, workingDays)
  };
}
function manufacturingRepeatDays(frequency, customDays) {
  return frequency === 'weekly' ? 7 : frequency === 'fortnightly' ? 14 : frequency === 'custom' && Number.isSafeInteger(Number(customDays)) && Number(customDays) > 0 ? Number(customDays) : null;
}
function manufacturingFrequencyLabel(order) {
  const days = manufacturingRepeatDays(order.frequency, order.repeatEveryDays);
  return days ? 'Every ' + days + ' ' + (days === 1 ? 'day' : 'days') + ' · quantity per repeat' : 'One-time order';
}

export { manufacturingOrderPlan, manufacturingRepeatDays, manufacturingFrequencyLabel };
