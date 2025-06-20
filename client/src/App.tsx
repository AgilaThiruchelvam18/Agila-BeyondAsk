import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "./components/ui/toaster";
import { AuthProvider } from "./components/auth/auth-provider";
import { AuthGuard } from "./components/auth/auth-guard";
import Home from "./pages/home";
import NotFound from "./pages/not-found";
import Callback from "./pages/callback";
import ComponentShowcase from "./pages/component-showcase";
import Invitation from "./pages/invitation";
import WidgetTest from "./pages/widget-test";
import KnowledgeFlow from "./pages/knowledge-flow";
import Dashboard from "./pages/dashboard";
import Agents from "./pages/agents";
import AgentMarketplacePage from "./pages/agent-marketplace-page";
import KnowledgeBases from "./pages/knowledge-bases";
import VisualizerBoards from "./pages/visualizer-boards";
import VisualizerBoard from "./pages/visualizer-board";
import ApiKeys from "./pages/api-keys";
import ApiWebhookKeys from "./pages/api-webhook-keys";
import ApiKeysManagement from "./pages/api-keys-management";
import Profile from "./pages/profile";
import KnowledgeBaseDetail from "./pages/knowledge-base-detail";
import Chat from "./pages/chat";
import AgentDetail from "./pages/agent-detail";
import UnansweredQuestions from "./pages/unanswered-questions";
import PineconeExplorer from "./pages/pinecone-explorer";
import ScheduledUpdates from "./pages/scheduled-updates";
import Contacts from "./pages/contacts";
import Teams from "./pages/teams";
import TeamDetail from "./pages/team-detail";
import Integrations from "./pages/integrations";
import UsageMetricsDashboard from "./pages/metrics/usage-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/callback" component={Callback} />
      <Route path="/components" component={ComponentShowcase} />
      <Route path="/invite/:token" component={Invitation} />
      <Route path="/widget-test" component={WidgetTest} />
      <Route path="/knowledge-flow">
        <AuthGuard>
          <KnowledgeFlow />
        </AuthGuard>
      </Route>
      <Route path="/dashboard">
        <AuthGuard>
          <Dashboard />
        </AuthGuard>
      </Route>
      <Route path="/agents">
        <AuthGuard>
          <Agents />
        </AuthGuard>
      </Route>
      <Route path="/agent-marketplace">
        <AuthGuard>
          <AgentMarketplacePage />
        </AuthGuard>
      </Route>
      <Route path="/knowledge-bases">
        <AuthGuard>
          <KnowledgeBases />
        </AuthGuard>
      </Route>
      <Route path="/visualizer-boards">
        <AuthGuard>
          <VisualizerBoards />
        </AuthGuard>
      </Route>
      <Route path="/visualizer-board/:id">
        <AuthGuard>
          <VisualizerBoard />
        </AuthGuard>
      </Route>

      <Route path="/api-keys">
        <AuthGuard>
          <ApiKeys />
        </AuthGuard>
      </Route>
      <Route path="/api-webhook-keys">
        <AuthGuard>
          <ApiWebhookKeys />
        </AuthGuard>
      </Route>
      <Route path="/api-keys-management">
        <AuthGuard>
          <ApiKeysManagement />
        </AuthGuard>
      </Route>
      <Route path="/profile">
        <AuthGuard>
          <Profile />
        </AuthGuard>
      </Route>
      <Route path="/knowledge-base/:id">
        <AuthGuard>
          <KnowledgeBaseDetail />
        </AuthGuard>
      </Route>
      <Route path="/chat/:agentId">
        <AuthGuard>
          <Chat />
        </AuthGuard>
      </Route>
      <Route path="/agent/:id">
        <AuthGuard>
          <AgentDetail />
        </AuthGuard>
      </Route>
      <Route path="/unanswered-questions">
        <AuthGuard>
          <UnansweredQuestions />
        </AuthGuard>
      </Route>
      <Route path="/pinecone-explorer">
        <AuthGuard>
          <PineconeExplorer />
        </AuthGuard>
      </Route>
      <Route path="/scheduled-updates">
        <AuthGuard>
          <ScheduledUpdates />
        </AuthGuard>
      </Route>
      <Route path="/contacts">
        <AuthGuard>
          <Contacts />
        </AuthGuard>
      </Route>
      <Route path="/teams">
        <AuthGuard>
          <Teams />
        </AuthGuard>
      </Route>
      <Route path="/team/:id">
        <AuthGuard>
          <TeamDetail />
        </AuthGuard>
      </Route>
      <Route path="/integrations">
        <AuthGuard>
          <Integrations />
        </AuthGuard>
      </Route>
      <Route path="/metrics/usage">
        <AuthGuard>
          <UsageMetricsDashboard />
        </AuthGuard>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;