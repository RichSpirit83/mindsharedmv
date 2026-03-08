import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import BreakoutsList from "@/pages/admin/BreakoutsList";
import SessionConfig from "@/pages/admin/SessionConfig";
import MatchingWorkspace from "@/pages/admin/MatchingWorkspace";
import LeadBriefings from "@/pages/admin/LeadBriefings";
import PublicAttendeeView from "@/pages/PublicAttendeeView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<BreakoutsList />} />
            <Route path="session/:sessionId" element={<SessionConfig />} />
            <Route path="match/:sessionId" element={<MatchingWorkspace />} />
            <Route path="leads/:sessionId" element={<LeadBriefings />} />
          </Route>
          <Route path="/s/:sessionSlug" element={<PublicAttendeeView />} />
          <Route path="/" element={<BreakoutsList />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
