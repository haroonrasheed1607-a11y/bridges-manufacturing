// state/demoData.js
import { STORAGE_KEY } from "../config/storage.js";
import { manufacturingAutoSubJobs, manufacturingDefaultParts, manufacturingWorkSeconds } from "../domain/workOrders.js";
import { manufacturingFinish, manufacturingToday } from "../utils/dates.js";

function manufacturingDemoData() {
  const today = manufacturingToday(),
    start = manufacturingFinish(today, 1),
    due = manufacturingFinish(start, 6),
    stamp = new Date().toISOString();
  const customers = ['Demo · Northstar Hardware', 'Demo · Greenleaf Retail', 'Demo · Harbor Medical', 'Demo · Brightside Supplies', 'Demo · Summit Components'];
  const people = [['COACH-1', 'Maya Chen', 'Job Coach', 'coach', 6], ['COACH-2', 'Daniel Brooks', 'Job Coach', 'coach', 6], ['PERSON-1', 'Alex Rivera', 'Assembly', 'individual', 6], ['PERSON-2', 'Jordan Patel', 'Packaging', 'individual', 6], ['PERSON-3', 'Sam Taylor', 'Assembly & packaging', 'individual', 6], ['PERSON-4', 'Casey Morgan', 'Assembly', 'individual', 6], ['PERSON-5', 'Jamie Wilson', 'Packaging', 'individual', 4], ['PERSON-6', 'Riley Parker', 'Assembly & packaging', 'individual', 6]].map(([id, name, role, kind, hoursPerDay]) => ({
    id: 'DEMO-' + id,
    name: 'Demo · ' + name,
    role,
    kind,
    hoursPerDay
  }));
  const titles = ['Fastener kits request', 'Retail display assembly', 'Medical supply bundles', 'Welcome pack preparation', 'Bolt and washer assembly', 'Safety kit inspection', 'Spare parts packing', 'Hardware warehouse transfer', 'Store replenishment delivery', 'Completed starter kits'];
  const orders = titles.map((title, index) => {
    const id = 'DEMO-ORD-' + String(index + 1).padStart(3, '0'),
      quantity = index === 4 ? 3600 : 300 + index * 100,
      perPack = 25;
    const order = {
      id,
      demo: true,
      customer: customers[index % customers.length],
      title: 'Demo · ' + title,
      quantity,
      perPack,
      packCount: Math.ceil(quantity / perPack),
      frequency: ['one-time', 'weekly', 'fortnightly', 'custom'][index % 4],
      repeatEveryDays: [null, 7, 14, 10][index % 4],
      expected: due,
      required: due,
      stage: index < 4 ? 0 : index - 3,
      workOrders: [],
      history: [{
        id: id + '-CREATED',
        message: 'Sample order created for workflow testing.',
        at: stamp
      }]
    };
    if (index === 0) return order;
    const work = {
      id: 'DEMO-WO-' + String(index + 1).padStart(3, '0'),
      type: index % 2 ? 'Packaging' : 'Assembly',
      description: title,
      instructions: '1. Check parts against the illustrated sample.\n2. Assemble or pack the required pieces.\n3. Count each pack and scan its box label after completion.',
      quantity,
      perPack,
      people: 2,
      seconds: 30,
      packSeconds: 45,
      packageSeconds: 795,
      timingVersion: 2,
      hoursPerDay: 6,
      startDate: start,
      expected: due,
      required: due,
      parts: manufacturingDefaultParts(),
      packsPerSubJob: 12,
      jobs: [],
      audits: [],
      packing: [],
      boxes: []
    };
    work.totalSeconds = manufacturingWorkSeconds(work);
    work.jobs = manufacturingAutoSubJobs(work);
    if (index >= 2) order.workOrderApprovedAt = stamp;
    if (index >= 3) {
      order.assignmentConfirmedAt = stamp;
      work.coachId = people[index % 2].id;
      work.coachName = people[index % 2].name;
    }
    if (index >= 4) order.productionStartedAt = stamp;
    if (index >= 5) {
      work.jobs = work.jobs.map(job => ({
        ...job,
        completed: job.quantity
      }));
      work.boxes = [{
        id: 'DEMO-BOX-' + String(index + 1).padStart(3, '0') + '-DONE',
        jobId: work.jobs[0].id,
        personId: people[2 + index % 4].id,
        quantity: 25,
        completedPieces: 25,
        status: 'completed',
        createdAt: stamp,
        completedAt: stamp,
        date: start,
        coachId: work.coachId
      }];
    }
    if (index >= 6) work.audits = [{
      id: work.id + '-QC',
      mode: '100% Check',
      inspected: quantity,
      failed: 0,
      inspector: people[0].name,
      notes: 'Sample passing inspection: all pieces checked.',
      at: stamp
    }];
    if (index >= 7) work.packing = [{
      id: work.id + '-PACK',
      correct: true,
      result: 'correct',
      checker: people[3].name,
      notes: 'Sample packing check: labels, counts and inserts verified.',
      at: stamp
    }];
    if (index >= 8) order.warehouse = {
      sentAt: stamp,
      receivedAt: stamp,
      location: 'Demo warehouse · Rack A2',
      receiver: 'Demo · Warehouse team'
    };
    if (index === 9) order.delivery = {
      approved: true,
      approvedAt: stamp,
      approver: people[0].name,
      method: 'Customer Pickup',
      details: 'Demo customer collected from main reception.',
      dispatchedAt: stamp,
      signatory: 'Demo Customer',
      signedAt: stamp,
      signature: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="120"><text x="20" y="75" font-size="36" font-family="cursive">Demo Customer · SAMPLE</text></svg>')
    };
    order.workOrders = [work];
    return order;
  });
  const active = orders[4],
    work = active.workOrders[0];
  work.boxes = [{
    id: 'DEMO-BOX-001',
    jobId: work.jobs[0].id,
    personId: people[2].id,
    quantity: 25,
    createdAt: stamp,
    date: start,
    coachId: work.coachId
  }, {
    id: 'DEMO-BOX-002',
    jobId: work.jobs[0].id,
    personId: people[3].id,
    quantity: 25,
    createdAt: stamp,
    date: start,
    coachId: work.coachId
  }, {
    id: 'DEMO-BOX-003',
    jobId: work.jobs[0].id,
    personId: people[4].id,
    quantity: 25,
    completedPieces: 25,
    status: 'completed',
    createdAt: stamp,
    completedAt: stamp,
    date: start,
    coachId: work.coachId
  }];
  work.jobs[0].completed = 25;
  const bookings = work.boxes.map(box => ({
    id: box.id,
    personId: box.personId,
    orderId: active.id,
    workId: work.id,
    start,
    end: start,
    hours: manufacturingWorkSeconds({
      ...work,
      quantity: box.quantity
    }) / 3600,
    status: 'booked',
    notes: 'Demo box assignment'
  }));
  for (const [personIndex, hours] of [[2, 5], [3, 3], [4, 1]]) bookings.push({
    id: 'DEMO-BOOK-' + personIndex,
    personId: people[personIndex].id,
    orderId: active.id,
    workId: work.id,
    start,
    end: manufacturingFinish(start, 3),
    hours: hours * 3,
    status: 'booked',
    notes: 'Demo capacity booking for remaining production'
  });
  bookings.push({
    id: 'DEMO-BOOK-FUTURE',
    personId: people[5].id,
    orderId: orders[3].id,
    workId: orders[3].workOrders[0].id,
    start: manufacturingFinish(start, 4),
    end: manufacturingFinish(start, 5),
    hours: 8,
    status: 'booked',
    notes: 'Demo upcoming work reservation'
  });
  return {
    orders,
    customers,
    workforce: {
      people,
      bookings
    }
  };
}
var manufacturingInitialCache;
function manufacturingInitialData() {
  if (manufacturingInitialCache) return manufacturingInitialCache;
  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
  const rawOrders = read(STORAGE_KEY, []),
    rawCustomers = read(STORAGE_KEY + '-customers', []),
    rawWorkforce = read(STORAGE_KEY + '-workforce', {});
  const data = {
    orders: Array.isArray(rawOrders) ? rawOrders : [],
    customers: Array.isArray(rawCustomers) ? rawCustomers : [],
    workforce: {
      people: Array.isArray(rawWorkforce?.people) ? rawWorkforce.people : [],
      bookings: Array.isArray(rawWorkforce?.bookings) ? rawWorkforce.bookings : []
    }
  };
  if (!read(STORAGE_KEY + '-demo-seed-v1', false)) {
    const demo = manufacturingDemoData(),
      merge = (current, extra) => [...current, ...extra.filter(item => !current.some(existing => existing.id === item.id))];
    data.orders = merge(data.orders, demo.orders);
    data.customers = [...new Set([...data.customers, ...demo.customers])];
    data.workforce = {
      people: merge(data.workforce.people, demo.workforce.people),
      bookings: merge(data.workforce.bookings, demo.workforce.bookings)
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.orders));
      localStorage.setItem(STORAGE_KEY + '-customers', JSON.stringify(data.customers));
      localStorage.setItem(STORAGE_KEY + '-workforce', JSON.stringify(data.workforce));
      localStorage.setItem(STORAGE_KEY + '-demo-seed-v1', 'true');
    } catch {}
  }
  manufacturingInitialCache = data;
  return data;
}

export { manufacturingDemoData, manufacturingInitialCache, manufacturingInitialData };
