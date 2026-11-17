import { canUsePlan, canUseShopFloor } from '../features/auth/permissions.js';

export const optionalViews = ['board', 'orders', 'new', 'workflow', 'availability', 'shopfloorprint', 'optionalorder', 'optionalpeople', 'optionalboxes'];
export function workspaceGroups(role, desktop = false) {
  const daily = [], supporting = [];
  const manager = ['admin', 'manager'].includes(role);
  if (desktop) return [{ id: 'daily', label: 'Daily Operations', items: [['Shop Floor', 'productionline']] }];
  if (manager) daily.push(['Dashboard', 'dashboard']);
  if (canUsePlan(role)) daily.push(['Plan', 'plan']);
  if (canUseShopFloor(role)) daily.push(['Shop Floor', 'productionline']);
  if (manager || role === 'coach') daily.push(['Attendance', 'attendance'], ['Timesheets', 'timesheets']);
  if (manager) supporting.push(['Clients', 'customers'], ['Individuals', 'individuals']);
  if (role === 'admin') supporting.push(['Users', 'users'], ['Configurations', 'configurations']);
  // Scanner/setup accounts retain only their role's daily tools.
  return [
    { id: 'daily', label: 'Daily Operations', items: daily },
    { id: 'supporting', label: 'Supporting Administration', items: supporting },
  ].filter(group => group.items.length);
}
export function workspaceParent(view) {
  if (optionalViews.includes(view)) return ['configurations', 'Configurations'];
  if (['customers', 'individuals', 'users', 'configurations'].includes(view)) return [null, 'Supporting Administration'];
  return [null, 'Daily Operations'];
}
