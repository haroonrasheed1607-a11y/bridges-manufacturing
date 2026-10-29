import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ManufacturingProvider } from './state/ManufacturingContext.jsx';
import './styles/app.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><ManufacturingProvider><App /></ManufacturingProvider></React.StrictMode>);
