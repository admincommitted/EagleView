import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AppToast } from './components/ui/app-toast';
import RenderRoutes from './routes/RenderRoutes';
import { useStoreSync } from './store';

const toastOptions = { duration: 4000 };

export default function App() {
  useStoreSync();
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <RenderRoutes />
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={toastOptions}>{(item) => <AppToast item={item} />}</Toaster>
    </ErrorBoundary>
  );
}
