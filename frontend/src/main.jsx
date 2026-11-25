import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/tailwind.css';
import { startDomFlags } from './domFlags';
import { installLegacyHttpHooks } from './services/legacyHttp';
import { TooltipProvider } from '@/components/ui/tooltip';

installLegacyHttpHooks();
startDomFlags();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TooltipProvider delayDuration={250}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
