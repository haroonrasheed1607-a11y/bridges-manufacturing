import {React} from '../../vendor/react-runtime.js';
import {jobCompletion} from '../../domain/jobCompletion.js';
export function JobCompletion({order}){
 const {total,completed,percent}=jobCompletion(order),h=React.createElement,unit=order.totalBillableUnits!=null?' billable units completed':' pieces completed';
 return h('div',{className:'job-completion',title:completed.toLocaleString()+' / '+total.toLocaleString()+unit},
 h('span',null,percent+'% done'),h('progress',{max:100,value:percent,'aria-label':'Production completion','aria-valuetext':percent+'% · '+completed+' of '+total+unit}));
}
