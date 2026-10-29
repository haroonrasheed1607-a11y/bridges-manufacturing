export const stages=['New Order','Work Order','Quality Check','Packing','Warehouse','Delivery','Order Completion'];
export const uid=prefix=>{
 const bytes=new Uint8Array(8);
 globalThis.crypto.getRandomValues(bytes);
 return `${prefix}-${Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase()}`;
};
export function packsFor(job,perPack){
  if(!Number.isSafeInteger(job.quantity)||job.quantity<1||!Number.isSafeInteger(perPack)||perPack<1) return [];
  return Array.from({length:Math.ceil(job.quantity/perPack)},(_,i)=>({id:`${job.id}-${String(i+1).padStart(3,'0')}`,type:job.packType,pieces:Math.min(perPack,job.quantity-i*perPack)}));
}
export const allPacks=order=>order.workOrders.flatMap(w=>w.jobs.flatMap(j=>packsFor(j,w.perPack).map(p=>({...p,workOrder:w.id,job:j.name}))));
export function validateWork(w){
 if(!['Assembly','Packing'].includes(w.type)) return 'Choose Assembly or Packing.';
 if(!w.description.trim()||!w.instructions.trim())return 'Description and instructions are required.';
 if(![w.quantity,w.perPack,w.people].every(n=>Number.isSafeInteger(n)&&n>0))return 'Pieces, pieces per pack and people must be positive whole numbers.';
 if(w.quantity>1000000||w.perPack>1000000)return 'The screen draft supports up to 1,000,000 pieces per work order.';
 if(!Number.isFinite(w.seconds)||w.seconds<=0)return 'Time per piece must be greater than zero.';
 if(!w.expected||!w.required)return 'Both delivery dates are required.';
 if(!w.jobs.length||w.jobs.some(j=>!j.name.trim()||!Number.isSafeInteger(j.quantity)||j.quantity<1||!['Box','Packet'].includes(j.packType)))return 'Each sub-job needs a name, positive whole quantity and pack type.';
 if(w.jobs.reduce((n,j)=>n+j.quantity,0)!==w.quantity)return 'Sub-job pieces must add up to the work-order quantity.';
 return '';
}
export function auditError(a,w){
 if(!['Random Audit','100% Check'].includes(a.mode))return 'Choose a check method.';
 if(!a.inspector?.trim())return 'Enter the inspector name.';
 if(!Number.isInteger(a.inspected)||a.inspected<1||a.inspected>w.quantity)return 'Inspected pieces must be between 1 and the work-order quantity.';
 if(!Number.isInteger(a.failed)||a.failed<0||a.failed>a.inspected)return 'Failed pieces must be between zero and the inspected quantity.';
 if(a.mode==='100% Check'&&a.inspected!==w.quantity)return 'A 100% check must inspect every piece.';
 return '';
}
export function gate(order){
 const ws=order.workOrders;
 switch(order.stage){
 case 0:return !ws.length?'Add at least one work order.':ws.map(validateWork).find(Boolean)||'';
 case 1:return ws.some(w=>w.jobs.some(j=>j.completed!==j.quantity))?'Complete every sub-job before quality checking.':'';
 case 2:return ws.some(w=>!w.audits.length||auditError(w.audits.at(-1),w)||w.audits.at(-1).failed>0)?'Each work order needs a passing quality check.':'';
 case 3:return ws.some(w=>!w.packing.length||!w.packing.at(-1).correct)?'Confirm correct packing for every work order.':'';
 case 4:return !order.warehouse?.receivedAt?'Confirm receipt into the warehouse.':'';
 case 5:return !order.delivery?.dispatchedAt?'Approve and dispatch the delivery first.':!order.delivery?.signature?'The customer must sign before this order can be completed.':'';
 default:return 'This order is completed.';
 }
}
