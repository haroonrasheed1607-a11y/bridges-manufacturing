export async function systemUpdateResponse(base:string,key:string,reply:(value:unknown,status?:number)=>Response):Promise<Response|null> {
 try {
  const response=await fetch(base+'/rest/v1/rpc/app_system_status',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}'});
  const status=await response.json();
  if(!response.ok||typeof status?.updating!=='boolean')throw new Error('System status unavailable');
  return status.updating?reply({code:'PT503',message:'System under update, please wait'},503):null;
 }catch{return reply({code:'SYSTEM_STATUS_UNAVAILABLE',message:'System unavailable, please wait'},503);}
}
