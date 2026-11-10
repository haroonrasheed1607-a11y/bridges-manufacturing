import VersionButton from '../../components/VersionButton.jsx';
import { React } from '../../vendor/react-runtime.js';
import { manufacturingApi } from '../../api/supabaseClient.js';
import { manufacturingWorkLogo } from '../../assets/workLogo.js';

function AuthGate({children, api=manufacturingApi, portal='manufacturing'}){
 const accounts=portal==='accounts';
 const h=React.createElement,[profile,setProfile]=React.useState(null),[loading,setLoading]=React.useState(true),[email,setEmail]=React.useState(''),[password,setPassword]=React.useState(''),[error,setError]=React.useState('');
 async function check(){setLoading(true);setError('');try{if(api.hasSession()){const user=await api.rpc('app_my_profile');setProfile(user);}else setProfile(null);}catch(e){setError(e.message);setProfile(null);}finally{setLoading(false);}}
 React.useEffect(()=>{check();},[]);
 async function submit(event){event.preventDefault();setLoading(true);setError('');try{await api.login(email,password);setPassword('');setProfile(await api.rpc('app_my_profile'));}catch(e){setError(e.message);}finally{setLoading(false);}}
 async function quickLogin(mode){setLoading(true);setError('');try{await api.shopFloorLogin(mode);setProfile(await api.rpc('app_my_profile'));}catch(e){setError(e.message);}finally{setLoading(false);}}
 async function signOut(){await api.logout();setProfile(null);}
 const wrongPortal=profile?.active&&(accounts ? profile.role!=='accounts' : profile.role==='accounts');
 if(profile?.active&&!wrongPortal)return h(SessionActions.Provider,{value:{signOut}},h(ManufacturingSession.Provider,{value:profile,key:profile.id},children));
 return h('main',{className:'auth-page'},h('section',{className:'auth-panel'},h('div',{className:'auth-brand'},h('img',{src:manufacturingWorkLogo,alt:'Bridges'})),h('h1',null,accounts?'Accounts sign-in':'Manufacturing workspace'),loading?h('p',{role:'status'},'Connecting securely…'):wrongPortal?h(React.Fragment,null,h('p',null,accounts?'Use an Accounts login for this portal.':'Use the Accounts sign-in for this account.'),h('a',{href:accounts?'/':'/accounts'},accounts?'Open Manufacturing':'Open Accounts'),h('button',{type:'button',onClick:signOut},'Sign out')):profile?h(React.Fragment,null,h('h2',null,'Staff access required'),h('p',null,'Your account is signed in and is awaiting approval by the administrator.'),h('button',{type:'button',onClick:check},'Check approval'),h('button',{type:'button',onClick:signOut},'Sign out')):h('form',{onSubmit:submit},!accounts&&h('div',{className:'shop-floor-login-actions'},h('button',{type:'button',className:'primary',onClick:()=>quickLogin('scanner')},'Log in as scanner'),h('button',{type:'button',className:'primary',onClick:()=>quickLogin('boxer')},'Log in as boxer')),!accounts&&h('p',null,'Or sign in with your administrator or staff account.'),h('label',null,accounts?'Username':'Username or email',h('input',{type:'text',required:true,placeholder:accounts?'Accounts username':'Staff username or email',autoCapitalize:'none',spellCheck:false,autoComplete:'username',value:email,onChange:e=>setEmail(e.target.value)})),h('label',null,'Password',h('input',{type:'password',required:true,autoComplete:'current-password',value:password,onChange:e=>setPassword(e.target.value)})),h('button',{className:'primary',disabled:loading},'Sign in'),h('small',null,accounts?'Ask your administrator for an Accounts login.':'Ask the administrator to create or approve your staff account.')),error&&h('p',{className:'alert',role:'alert'},error)),h(VersionButton));
}
const ManufacturingSession=React.createContext(null);
const SessionActions=React.createContext(null);
export { AuthGate, ManufacturingSession, SessionActions };
