export function jobCompletion(order){
 const works=order.workOrders||[];
 const amount=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
 const total=works.length?works.reduce((sum,w)=>sum+amount(w.quantity),0):amount(order.quantity);
 const completed=works.reduce((sum,w)=>sum+Math.min(amount(w.quantity),(w.jobs||[]).reduce((n,j)=>n+Math.min(amount(j.quantity),amount(j.completed)),0)),0);
 const percent=total?Math.min(100,Math.floor(completed/total*100)):0;
 return {total,completed,percent};
}
