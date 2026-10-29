export function Field({label,children,hint}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Badge({children,tone=''}){return <span className={'badge '+tone}>{children}</span>;}
export function Empty({children}){return <div className="empty">{children}</div>;}
export const dateText=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
export const timeText=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',timeZoneName:'short'}):'—';
