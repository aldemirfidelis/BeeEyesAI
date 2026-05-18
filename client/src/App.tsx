import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";
import CasaDaBee from "@/pages/CasaDaBee";
import { IosInstallPrompt } from "@/components/IosInstallPrompt";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/casa-da-bee" component={CasaDaBee} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <IosInstallPrompt />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
