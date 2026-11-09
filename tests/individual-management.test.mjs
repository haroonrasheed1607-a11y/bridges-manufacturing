import test from 'node:test';
import assert from 'node:assert/strict';
import {availableHoursOn, bookingDates, manufacturingBookedDay, manufacturingIndividualCapacity} from '../src/domain/workforce.js';

test('weekly hours repeat, support weekend bookings and do not move old allocations', () => {
  const person = {id:'P1',hoursPerDay:6,weeklyHours:[4,0,3,0,0,2,0]};
  assert.deepEqual(bookingDates(person,'2026-11-09','2026-11-15'),['2026-11-09','2026-11-11','2026-11-14']);
  assert.equal(availableHoursOn(person,'2026-11-16'),4);
  assert.equal(availableHoursOn({...person,active:false},'2026-11-16'),0);
  const orders = [{id:'O1',stage:1,workOrders:[{id:'W1'}]}];
  const bookings = [{id:'B1',personId:person.id,orderId:'O1',workId:'W1',start:'2026-11-14',end:'2026-11-15',hours:2,allocatedDates:['2026-11-14']}];
  assert.equal(manufacturingBookedDay({...person,weeklyHours:[4,0,3,0,0,0,2]},'2026-11-14',bookings,orders),2);
  assert.deepEqual(manufacturingIndividualCapacity(person,'2026-11-09','2026-11-15',bookings,orders),{booked:2,free:7,over:0,capacity:9});
});
