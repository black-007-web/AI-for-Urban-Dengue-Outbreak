import { Suspense, lazy } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider } from './context/AppContext';
import { Aurora, Header, MobileNav, Sidebar } from './components/Layout';
import { CardSkeleton } from './components/Skeleton';
import { useApiStatus } from './hooks/useApiStatus';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const WeatherLags = lazy(() => import('./pages/WeatherLags'));
const ModelPerformance = lazy(() => import('./pages/ModelPerformance'));
const About = lazy(() => import('./pages/About'));

function PageFallback() {
  return (
    <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading page">
      <CardSkeleton height={260} /><CardSkeleton height={260} />
    </div>
  );
}

function Shell() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 lg:p-6 lg:pl-2">
        <Header />
        <MobileNav />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <Suspense fallback={<PageFallback />}>
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/weather" element={<WeatherLags />} />
                <Route path="/model" element={<ModelPerformance />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<Dashboard />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  const status = useApiStatus();
  return (
    <>
      <Aurora />
      {status.ready ? (
        <AppProvider><Shell /></AppProvider>
      ) : (
        <div className="min-h-screen grid place-items-center" role="status" aria-label="Connecting to backend">
          <div className="text-center">
            <div className="mx-auto size-12 rounded-full border-4 border-lagoon border-t-transparent animate-spin" />
            <p className="mt-4 text-sm text-muted">Checking the prediction service…</p>
          </div>
        </div>
      )}
    </>
  );
}
