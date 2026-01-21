import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import PaperDetail from "./pages/PaperDetail";
import Reader from "./pages/Reader";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SessionDebug from "./pages/SessionDebug";
import Profile from "./pages/Profile";
import MyAnnotations from "./pages/MyAnnotations";
import MyComments from "./pages/MyComments";
import MyReviews from "./pages/MyReviews";
import MyAiSessions from "./pages/MyAiSessions";
import About from "./pages/About";
import Admin from "./pages/Admin";
import ModelRankings from "./pages/ModelRankings";
import TopContributors from "./pages/TopContributors";
import Notifications from "./pages/Notifications";
import ChallengeProblems from "./pages/ChallengeProblems";
import ChallengeProblemDetail from "./pages/ChallengeProblemDetail";
import Debates from "./pages/Debates";
import DebateView from "./pages/DebateView";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/browse" component={Browse} />
      <Route path="/paper/:id" component={PaperDetail} />
      <Route path="/paper/:id/read" component={Reader} />
      <Route path="/paper/:paperId/session/:sessionId/debug" component={SessionDebug} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/profile/:userId" component={Profile} />
      <Route path="/my-annotations" component={MyAnnotations} />
      <Route path="/my-comments" component={MyComments} />
      <Route path="/my-reviews" component={MyReviews} />
      <Route path="/my-ai-sessions" component={MyAiSessions} />
      <Route path="/about" component={About} />
      <Route path="/admin" component={Admin} />
      <Route path="/model-rankings" component={ModelRankings} />
      <Route path="/model-rankings/:modelId" component={ModelRankings} />
      <Route path="/top-contributors" component={TopContributors} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/challenge-problems" component={ChallengeProblems} />
      <Route path="/challenge/:id" component={ChallengeProblemDetail} />
      <Route path="/debates" component={Debates} />
      <Route path="/debate/:id" component={DebateView} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
