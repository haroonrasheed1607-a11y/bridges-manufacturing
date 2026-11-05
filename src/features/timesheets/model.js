export function monday(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
export function datesForWeek(week){return Array.from({length:7},(_,i)=>{const d=new Date(week+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10);});}
export function elapsed(start,end){if(!start||!end)return '';const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));const n=minutes(end)-minutes(start);return n>=0?+(n/60).toFixed(2):'';}
export function pieceSummary(entries,manual){const result={};for(const row of [...entries,...manual]){if(!row.code||!row.date)continue;const n=Number(row.pieces||0);if(!Number.isSafeInteger(n)||n<0)continue;result[row.code]??={};result[row.code][row.date]=(result[row.code][row.date]||0)+n;}return result;}

export function limitedLog(entries,manual,date,limit=8){
 const grouped=new Map();
 for(const row of [...entries,...manual].filter(e=>e.date===date)){
  const code=row.code||'—',time=row.time||row.start||'';
  const group=grouped.get(code)||{code,pieces:0,first:time,last:row.end||time,count:0};
  group.pieces+=Number(row.pieces||0);group.count++;
  if(time&&(!group.first||time<group.first))group.first=time;
  const end=row.end||time;if(end&&end>group.last)group.last=end;
  grouped.set(code,group);
 }
 let rows=[...grouped.values()].sort((a,b)=>a.first.localeCompare(b.first)||a.code.localeCompare(b.code));
 if(rows.length>limit){const extra=rows.slice(limit-1);rows=[...rows.slice(0,limit-1),{code:'Other ('+extra.length+' codes)',pieces:extra.reduce((n,r)=>n+r.pieces,0),first:'',last:'',count:extra.reduce((n,r)=>n+r.count,0)}];}
 return Array.from({length:limit},(_,i)=>rows[i]||{code:'',pieces:'',first:'',last:'',count:0});
}
export function limitedCodes(summary,dates,limit=6){const codes=Object.keys(summary).filter(c=>dates.some(d=>Number(summary[c][d]||0)>0));if(codes.length<=limit)return codes.map(code=>({code,values:summary[code]}));return [...codes.slice(0,limit-1).map(code=>({code,values:summary[code]})),{code:'Other',values:Object.fromEntries(dates.map(d=>[d,codes.slice(limit-1).reduce((n,c)=>n+Number(summary[c][d]||0),0)]))}];}

export function attendanceActionLog(data){
 const days=data.days||{};
 const manual=(data.manual||[]).filter(row=>!days[row.date]?.attendanceStatus||!['AT','DT'].includes(row.code));
 for(const [date,day] of Object.entries(days)){
  if(!day.attendanceStatus)continue;
  if(day.arrival)manual.push({date,code:'AT',time:day.arrival,pieces:0});
  if(day.departure)manual.push({date,code:'DT',time:day.departure,pieces:0});
 }
 return manual;
}
