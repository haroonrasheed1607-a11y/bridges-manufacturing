import test from 'node:test';
import assert from 'node:assert/strict';
import { productionTabs, isShopFloorRole } from '../src/features/auth/permissions.js';
import { normalizeLogin } from '../src/api/supabaseClient.js';

test('shop floor aliases use separate case-insensitive identities', () => {
  assert.equal(normalizeLogin(' BOXSETUP '), 'boxsetup@bridges-manufacturing.local');
  assert.equal(normalizeLogin(' BoxScan '), 'boxscan@bridges-manufacturing.local');
});
test('each shop-floor role has only its designated production task', () => {
  assert.deepEqual(productionTabs('box_setup').map(([id]) => id), ['print']);
  assert.deepEqual(productionTabs('box_scanner').map(([id]) => id), ['scan']);
  assert.equal(isShopFloorRole('box_setup'), true);
  assert.equal(isShopFloorRole('box_scanner'), true);
  for (const role of ['admin', 'manager', 'coach', 'station']) {
    assert.deepEqual(productionTabs(role).map(([id]) => id), ['scan', 'print']);
    assert.equal(isShopFloorRole(role), false);
  }
  assert.deepEqual(productionTabs(undefined), []);
  assert.deepEqual(productionTabs('unknown'), []);
});
