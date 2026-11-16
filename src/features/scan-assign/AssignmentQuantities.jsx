import { React } from '../../vendor/react-runtime.js';

export function assignmentQuantityText(row, orders = []) {
  const order = orders.find(order => order.id === row?.orderId);
  if (order?.totalBillableUnits == null) return row ? `${row.piecesPerScan} pieces/scan` : '';
  return `Total BU: ${Number(order.totalBillableUnits).toLocaleString()} · BU per Scan: ${Number(row.piecesPerScan).toLocaleString()}`;
}

export function AssignmentQuantities({ row, orders }) {
  if (!row) return null;
  return <span className="assignment-quantities" aria-label="Total Billable Units (BU) and BU per Scan">{assignmentQuantityText(row, orders)}</span>;
}
