import { React } from '../../vendor/react-runtime.js';
import { manufacturingApi } from '../../api/supabaseClient.js';
import { manufacturingWorkLogo } from '../../assets/workLogo.js';

function AuthGate({children}){
 const h=React.createElement,[profile,setProfile]=React.useState(null),[loading,setLoading]=React.useState(true),[email,setEmail]=React.useState(''),[password,setPassword]=React.useState(''),[error,setError]=React.useState('');
 async function check(){setLoading(true);setError('');try{if(manufacturingApi.hasSession()){const user=await manufacturingApi.rpc('app_my_profile');setProfile(user);}else setProfile(null);}catch(e){setError(e.message);setProfile(null);}finally{setLoading(false);}}
 React.useEffect(()=>{check();},[]);
 async function submit(event){event.preventDefault();setLoading(true);setError('');try{await manufacturingApi.login(email,password);setPassword('');setProfile(await manufacturingApi.rpc('app_my_profile'));}catch(e){setError(e.message);}finally{setLoading(false);}}
 async function signOut(){await manufacturingApi.logout();setProfile(null);}
 if(profile?.active)return h(React.Fragment,null,h('div',{className:'session-bar'},h('span',null,profile.name+' · '+profile.role),h('button',{type:'button',onClick:check},'Check access'),h('button',{type:'button',onClick:signOut},'Sign out')),h(ManufacturingSession.Provider,{value:profile},children));
 return h('main',{className:'auth-page'},h('section',{className:'auth-panel'},h('div',{className:'auth-brand'},h('img',{src:manufacturingWorkLogo,alt:'Bridges'})),h('h1',null,'Manufacturing workspace'),loading?h('p',{role:'status'},'Connecting securely…'):profile?h(React.Fragment,null,h('h2',null,'Staff access required'),h('p',null,'Your account is signed in and is awaiting approval by the administrator.'),h('button',{type:'button',onClick:check},'Check approval'),h('button',{type:'button',onClick:signOut},'Sign out')):h('form',{onSubmit:submit},h('p',null,'Sign in with your staff account to use the shared database.'),h('label',null,'Username or email',h('input',{type:'text',required:true,placeholder:'admin or staff email',autoCapitalize:'none',spellCheck:false,autoComplete:'username',value:email,onChange:e=>setEmail(e.target.value)})),h('label',null,'Password',h('input',{type:'password',required:true,autoComplete:'current-password',value:password,onChange:e=>setPassword(e.target.value)})),h('button',{className:'primary',disabled:loading},'Sign in'),h('small',null,'Ask the administrator to create or approve your staff account.')),error&&h('p',{className:'alert',role:'alert'},error)));
}
const ManufacturingSession=React.createContext(null);
export { AuthGate, ManufacturingSession };
