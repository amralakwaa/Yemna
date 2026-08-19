/** فلسفة يمنا: تطبيق عربي RTL ذو مسارات مترابطة، لا صفحات تجريبية معزولة. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { HomePage, LoginPage, ProfilePage, FriendsPage, SearchPage, MessagesPage, NotificationsPage, CommunitiesPage, MediaPage, SettingsPage, AIPage, AdminPage, StatesPage, CreatePage, NotFoundPage } from "./pages/YemnaPages";

function Router() { return <Switch>
  <Route path="/" component={HomePage}/><Route path="/login" component={LoginPage}/><Route path="/profile" component={ProfilePage}/><Route path="/friends" component={FriendsPage}/><Route path="/search" component={SearchPage}/><Route path="/messages" component={MessagesPage}/><Route path="/notifications" component={NotificationsPage}/><Route path="/communities" component={CommunitiesPage}/><Route path="/media" component={MediaPage}/><Route path="/settings" component={SettingsPage}/><Route path="/ai" component={AIPage}/><Route path="/admin" component={AdminPage}/><Route path="/states" component={StatesPage}/><Route path="/create" component={CreatePage}/><Route component={NotFoundPage}/>
</Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-center"/><Router/></TooltipProvider></ThemeProvider></ErrorBoundary>; }
