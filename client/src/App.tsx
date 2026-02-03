import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Properties from "./pages/Properties";
import ValidationQueue from "./pages/ValidationQueue";
import CustomerImport from "./pages/CustomerImport";
import Login from "./pages/Login";


function Router() {
  return (
    <>
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/"} component={Dashboard} />
        <Route path={"/dashboard"} component={Dashboard} />
        <Route path={"/customers"} component={Customers} />
        <Route path={"/properties"} component={Properties} />
        <Route path={"/validation-queue"} component={ValidationQueue} />
        <Route path={"/customer-import"} component={CustomerImport} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
