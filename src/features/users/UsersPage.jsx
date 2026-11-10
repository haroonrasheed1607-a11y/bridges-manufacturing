import { useEffect, useState } from 'react';
import { manufacturingApi } from '../../api/supabaseClient.js';
import { useManufacturing } from '../../state/ManufacturingContext.jsx';

export function UsersPage(){
 const {profile}=useManufacturing();
 const [users,setUsers]=useState([]),[page,setPage]=useState(1),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState(null),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[show,setShow]=useState(false),[createAccounts,setCreateAccounts]=useState(false);
 async function load(next=page){setBusy(true);setError('');try{const data=await manufacturingApi.adminUsers({action:'list',page:next});setUsers(data.users);setMore(data.hasMore);setPage(next);}catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{if(profile?.role==='admin')load(1);},[profile?.role]);
 function close(){setSelected(null);setPassword('');setConfirm('');setShow(false);}
 async function reset(event){event.preventDefault();setError('');setNotice('');if(password!==confirm){setError('Passwords do not match.');return;}setBusy(true);try{await manufacturingApi.adminUsers({action:'reset',userId:selected.id,password});setNotice('Password updated for '+selected.email+'. Use the new password at the next sign-in.');close();}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(profile?.role!=='admin')return <p role="alert">Administrator access required.</p>;
 return <div><div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h2>Users</h2><p className="quiet">Manage sign-in accounts and reset passwords.</p></div><div className="actions"><button type="button" className="primary" onClick={()=>setCreateAccounts(true)}>Create Accounts login</button><button onClick={()=>load()} disabled={busy}>Refresh</button></div></div>
 {createAccounts&&<AccountsLoginForm onClose={()=>setCreateAccounts(false)} onCreated={username=>{
   setCreateAccounts(false);setNotice('Accounts login created for '+username+'.');load(1);
 }}/>}
 {error&&<p className="alert" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <section className="panel"><p>Existing passwords cannot be viewed. Select a user to set a new password.</p>{busy&&<p role="status">Connecting…</p>}
 <div className="table-wrap"><table><thead><tr><th>Name / username</th><th>Email</th><th>Role</th><th>Access</th><th>Last sign-in</th><th>Password</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td>{user.name||user.email?.split('@')[0]||'—'}</td><td>{user.email}</td><td>{user.role}</td><td>{user.active?'Active':'Not approved'}</td><td>{user.lastSignIn?new Date(user.lastSignIn).toLocaleString():'Never'}</td><td><button disabled={busy} onClick={()=>{close();setSelected(user);setError('');setNotice('');}}>Set password</button></td></tr>)}</tbody></table></div>
 {!busy&&!users.length&&!error&&<p>No users found.</p>}
 <div className="actions"><button disabled={busy||page===1} onClick={()=>load(page-1)}>Previous</button><span>Page {page}</span><button disabled={busy||!more} onClick={()=>load(page+1)}>Next</button></div></section>
 {selected&&<section className="panel" aria-labelledby="reset-user-title"><h3 id="reset-user-title">Set password · {selected.email}</h3><form onSubmit={reset}><fieldset disabled={busy}><label>New password<input type={show?'text':'password'} autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm new password<input type={show?'text':'password'} autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label><p className="quiet">Use at least 8 characters. Current sessions may remain signed in.</p><button type="button" onClick={()=>setShow(!show)}>{show?'Hide':'Show'} new password</button><div className="actions"><button className="primary" type="submit">Save password</button><button type="button" onClick={close}>Cancel</button></div></fieldset></form></section>}</div>;
}

function AccountsLoginForm({onClose,onCreated}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(event){
  event.preventDefault();
  if(busy)return;
  setError('');
  if(password!==confirmation){setError('Passwords do not match.');return;}
  setBusy(true);
  try{
   const result=await manufacturingApi.adminUsers({action:'create_accounts',username,password});
   onCreated(result.username);
  }catch(problem){setError(problem.message);}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-labelledby="create-accounts-heading">
  <h3 id="create-accounts-heading">Create Accounts login</h3>
  <p className="quiet">This login opens the read-only Accounts portal at <a href="/accounts">/accounts</a>.</p>
  {error&&<p className="alert" role="alert">{error}</p>}
  <form onSubmit={save}>
   <fieldset className="workspace-controls" disabled={busy}>
    <div className="form-grid">
     <label className="field"><span>Accounts username</span><input required minLength={3} maxLength={32} autoCapitalize="none" autoComplete="off" value={username} onChange={event=>setUsername(event.target.value)} /></label>
     <label className="field"><span>Password</span><input type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} /></label>
     <label className="field"><span>Confirm password</span><input type="password" required autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} /></label>
    </div>
    <div className="actions"><button className="primary" type="submit">Create login</button><button type="button" onClick={onClose}>Cancel</button></div>
   </fieldset>
  </form>
 </section>;
}
