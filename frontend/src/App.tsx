import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Header from "@/components/Header.jsx";
import Footer from "@/components/Footer.jsx";

import Dashboard from "@/pages/Dashboard.jsx";
import UploadPage from "@/pages/UploadPage.jsx";
import ProcessingPage from "@/pages/ProcessingPage.jsx";
import ResultsPage from "@/pages/ResultsPage.jsx";
import ReviewPage from "@/pages/ReviewPage.jsx";
import AuditPage from "@/pages/AuditPage.jsx";
import ApplicationDetailPage from "@/pages/ApplicationDetailPage.jsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/processing" element={<ProcessingPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/audit/:id" element={<ApplicationDetailPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
