import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ManufacturingProvider } from './state/ManufacturingContext.jsx';
import { AuthGate } from './features/auth/AuthGate.js';
import './styles/web.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><AuthGate><ManufacturingProvider><App /></ManufacturingProvider></AuthGate></React.StrictMode>);
