import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './incident.css';
import './milestone.css';
import './export-evidence.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
