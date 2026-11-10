import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AccountsPortal } from './features/accounts/AccountsPortal.jsx';
import { ManufacturingProvider } from './state/ManufacturingContext.jsx';
import { AuthGate } from './features/auth/AuthGate.js';
import './styles/web.css';
const accounts = /^\/accounts\/?$/.test(window.location.pathname);
createRoot(document.getElementById('root')).render(<React.StrictMode>{accounts
  ? <AccountsPortal />
  : <AuthGate><ManufacturingProvider><App /></ManufacturingProvider></AuthGate>
}</React.StrictMode>);
