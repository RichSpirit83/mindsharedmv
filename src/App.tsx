import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";
import AdminLayout from "@/components/AdminLayout";
import BreakoutsList from "@/pages/admin/BreakoutsList";
import SessionConfig from "@/pages/admin/SessionConfig";
import MatchingWorkspace from "@/pages/admin/MatchingWorkspace";
import LeadBriefings from "@/pages/admin/LeadBriefings";
import LeadPool from "@/pages/admin/LeadPool";
import UserManagement from "@/pages/admin/UserManagement";
import PresentationView from "@/pages/admin/PresentationView";
import PublicAttendeeView from "@/pages/PublicAttendeeView";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/admin" replace /> : <Navigate to="/login" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route index element={<BreakoutsList />} />
              <Route path="session/:sessionId" element={<SessionConfig />} />
              <Route path="match/:sessionId" element={<MatchingWorkspace />} />
              <Route path="leads/:sessionId" element={<LeadBriefings />} />
              <Route path="lead-pool" element={<LeadPool />} />
              <Route path="users" element={<UserManagement />} />
            </Route>
            <Route
              path="/admin/present/:sessionId"
              element={
                <RequireAuth>
                  <PresentationView />
                </RequireAuth>
              }
            />
            <Route path="/s/:sessionSlug" element={<PublicAttendeeView />} />
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
