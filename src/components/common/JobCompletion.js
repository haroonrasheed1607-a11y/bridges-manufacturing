import {React} from '../../vendor/react-runtime.js';
import {jobCompletion} from '../../domain/jobCompletion.js';
export function JobCompletion({order}){
 const {total,completed,percent}=jobCompletion(order),h=React.createElement;
 return h('div',{className:'job-completion',title:completed.toLocaleString()+' / '+total.toLocaleString()+' pieces completed'},
 h('span',null,percent+'% done'),h('progress',{max:100,value:percent,'aria-label':'Production completion','aria-valuetext':percent+'% · '+completed+' of '+total+' pieces completed'}));
}
