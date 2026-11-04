export function remainingBoxPieces(work,job){
 const boxes=(work.boxes||[]).filter(box=>box.jobId===job.id);
 const done=boxes.filter(b=>b.completedAt||b.status==='completed').reduce((n,b)=>n+Number(b.completedPieces??b.quantity),0);
 const open=boxes.filter(b=>!b.completedAt&&b.status!=='completed').reduce((n,b)=>n+Number(b.quantity),0);
 return Math.max(0,Number(job.quantity)-Math.max(Number(job.completed||0),done)-open);
}
export function nextBoxJob(work){
 const jobs=(work.jobs||[]).filter(job=>remainingBoxPieces(work,job)>0);
 return jobs.find(job=>Number(job.completed)>0||(work.boxes||[]).some(b=>b.jobId===job.id))||jobs[0];
}
