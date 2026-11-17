import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceGroups, optionalViews } from '../src/config/workspaceNavigation.js';
import { validView } from '../src/state/navigationMemory.js';

test('daily navigation keeps optional workflows out of both desktop and mobile group data',()=>{
 const groups=workspaceGroups('admin');
 assert.deepEqual(groups.map(g=>g.label),['Daily Operations','Supporting Administration']);
 const routes=groups.flatMap(g=>g.items.map(([,route])=>route));
 for(const view of optionalViews)assert.ok(!routes.includes(view),view+' escaped into core navigation');
 for(const view of ['dashboard','plan','productionline','attendance','timesheets','customers','individuals','users','configurations'])assert.ok(routes.includes(view));
});
test('role-specific navigation preserves scanner and desktop limits',()=>{
 for(const role of ['box_scanner','box_setup','coach','station','manager']){
  const routes=workspaceGroups(role).flatMap(g=>g.items.map(([,route])=>route));
  assert.ok(!routes.includes('users'));assert.ok(!routes.includes('configurations'));
  for(const view of optionalViews)assert.notEqual(validView(role,view),view);
 }
 assert.deepEqual(workspaceGroups('admin',true)[0].items,[['Shop Floor','productionline']]);
 assert.equal(validView('coach','timesheets'),'timesheets');
 for(const view of optionalViews)assert.equal(validView('admin',view),view);
});
