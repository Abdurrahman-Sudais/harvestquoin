import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import Home from "@/pages/public/Home";
import Features from "@/pages/public/Features";
import Solutions from "@/pages/public/Solutions";
import HowItWorks from "@/pages/public/HowItWorks";
import Pricing from "@/pages/public/Pricing";
import About from "@/pages/public/About";
import Contact from "@/pages/public/Contact";
import { Login, Register } from "@/pages/public/Auth";

const Dashboard = lazy(() => import("@/pages/app/Dashboard"));
const Batches = lazy(() => import("@/pages/app/Batches"));
const BatchDetail = lazy(() => import("@/pages/app/BatchDetail"));
const Inspections = lazy(() => import("@/pages/app/Inspections"));
const InspectionForm = lazy(() => import("@/pages/app/InspectionForm"));
const Forecasting = lazy(() => import("@/pages/app/Forecasting"));
const Orders = lazy(() => import("@/pages/app/Orders"));
const OrderDetail = lazy(() => import("@/pages/app/OrderDetail"));
const Allocation = lazy(() => import("@/pages/app/Allocation"));
const Dispatch = lazy(() => import("@/pages/app/Dispatch"));
const Assistant = lazy(() => import("@/pages/app/Assistant"));
const Reports = lazy(() => import("@/pages/app/Reports"));
const SettingsPage = lazy(() => import("@/pages/app/Settings"));

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <StoreProvider user={user.name}>{children}</StoreProvider>;
}

const Loading = () => (
  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-forest-600 border-t-transparent" />
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="features" element={<Features />} />
            <Route path="solutions" element={<Solutions />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
          </Route>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route
            path="app"
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
            <Route path="batches" element={<Suspense fallback={<Loading />}><Batches /></Suspense>} />
            <Route path="batches/:id" element={<Suspense fallback={<Loading />}><BatchDetail /></Suspense>} />
            <Route path="inspections" element={<Suspense fallback={<Loading />}><Inspections /></Suspense>} />
            <Route path="inspections/new" element={<Suspense fallback={<Loading />}><InspectionForm /></Suspense>} />
            <Route path="forecasting" element={<Suspense fallback={<Loading />}><Forecasting /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<Loading />}><Orders /></Suspense>} />
            <Route path="orders/:id" element={<Suspense fallback={<Loading />}><OrderDetail /></Suspense>} />
            <Route path="allocation" element={<Suspense fallback={<Loading />}><Allocation /></Suspense>} />
            <Route path="dispatch" element={<Suspense fallback={<Loading />}><Dispatch /></Suspense>} />
            <Route path="assistant" element={<Suspense fallback={<Loading />}><Assistant /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<Loading />}><Reports /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<Loading />}><SettingsPage /></Suspense>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
    </AuthProvider>
  );
}
