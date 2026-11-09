const shopFloorRoles = ['box_setup', 'box_scanner'];
function isShopFloorRole(role) { return shopFloorRoles.includes(role); }
function canUsePlan(role) { return ['admin', 'manager', 'coach', 'station', 'box_setup'].includes(role); }
function productionTabs(role) {
  const tabs = [];
  if (['admin', 'manager', 'coach', 'station', 'box_scanner'].includes(role)) tabs.push(['scan', 'Scan & Complete Work']);
  if (canUsePlan(role)) tabs.push(['print', 'Generate Box Printouts']);
  return tabs;
}
export { canUsePlan, isShopFloorRole, productionTabs };
