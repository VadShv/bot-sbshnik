import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import ReportPage from "@/pages/report";
import History from "@/pages/history";
import About from "@/pages/about";
import Modules from "@/pages/modules";
import Pipeline from "@/pages/pipeline";
import PipelineReportPage from "@/pages/pipeline-report";
import Settings from "@/pages/settings";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pipeline" component={Pipeline} />
      <Route path="/pipeline-report/:id" component={PipelineReportPage} />
      <Route path="/report/:id" component={ReportPage} />
      <Route path="/history" component={History} />
      <Route path="/modules" component={Modules} />
      <Route path="/about" component={About} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
