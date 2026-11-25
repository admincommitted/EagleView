import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import RenderRoutes from './routes/RenderRoutes';
import { useStoreSync } from './store';

const toastOptions = {
  duration: 4000,
  style: {
    background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
    color: '#fff',
    fontWeight: '500',
    boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
    borderRadius: '10px',
    padding: '12px 20px',
  },
  success: { style: { background: 'linear-gradient(135deg, #064e3b, #10b981)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)' } },
  error: { style: { background: 'linear-gradient(135deg, #7f1d1d, #ef4444)', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)' } },
};

export default function App() {
  useStoreSync();
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <RenderRoutes />
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={toastOptions} />
    </ErrorBoundary>
  );
}
