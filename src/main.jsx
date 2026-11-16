import { APP_ENVIRONMENT } from "./config/supabase.js";
import { SystemUpdateGate } from "./features/system/SystemUpdateGate.jsx";
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AccountsPortal } from './features/accounts/AccountsPortal.jsx';
import { ManufacturingProvider } from './state/ManufacturingContext.jsx';
import { AuthGate } from './features/auth/AuthGate.js';
import './styles/web.css';
const accounts = /^\/accounts\/?$/.test(window.location.pathname);
createRoot(document.getElementById('root')).render(<React.StrictMode>{APP_ENVIRONMENT === "staging" && <div role="status" style={{background:"#a82027",color:"white",padding:"8px 12px",textAlign:"center",fontWeight:700}}>TEST ENVIRONMENT · Version 2.0 development · Sample data only</div>}<SystemUpdateGate>{accounts
  ? <AccountsPortal />
  : <AuthGate><ManufacturingProvider><App /></ManufacturingProvider></AuthGate>
}</SystemUpdateGate></React.StrictMode>);
