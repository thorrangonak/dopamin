import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { BetSlipProvider } from "./contexts/BetSlipContext";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
import Sports from "./pages/Sports";
import MyBets from "./pages/MyBets";
import Wallet from "./pages/Wallet";
import Assistant from "./pages/Assistant";
import Admin from "./pages/Admin";
import LiveScores from "./pages/LiveScores";
import EventDetail from "./pages/EventDetail";
import CasinoHome from "./pages/CasinoHome";
import CasinoCategory from "./pages/CasinoCategory";
import FAQ from "./pages/FAQ";
import Profile from "./pages/Profile";
import VipClub from "./pages/VipClub";
import CoinFlip from "./pages/games/CoinFlip";
import DiceGame from "./pages/games/Dice";
import Mines from "./pages/games/Mines";
import Crash from "./pages/games/Crash";
import RouletteGame from "./pages/games/Roulette";
import Plinko from "./pages/games/Plinko";
import Login from "./pages/Login";
import Register from "./pages/Register";

function Router() {
  return (
    <Switch>
      {/* Auth pages — outside AppLayout */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Main app — inside AppLayout */}
      <Route>
        {() => (
          <AppLayout>
            <Switch>
              {/* Sports */}
              <Route path="/" component={Home} />
              <Route path="/sports" component={Sports} />
              <Route path="/event/:sportKey/:eventId" component={EventDetail} />
              <Route path="/live" component={LiveScores} />
              <Route path="/my-bets" component={MyBets} />
              <Route path="/wallet" component={Wallet} />
              <Route path="/assistant" component={Assistant} />
              <Route path="/admin" component={Admin} />
              <Route path="/profile" component={Profile} />
              <Route path="/vip" component={VipClub} />

              {/* Casino */}
              <Route path="/casino" component={CasinoHome} />
              <Route path="/casino/:category" component={CasinoCategory} />

              {/* Casino Games */}
              <Route path="/game/coinflip" component={CoinFlip} />
              <Route path="/game/dice" component={DiceGame} />
              <Route path="/game/mines" component={Mines} />
              <Route path="/game/crash" component={Crash} />
              <Route path="/game/roulette" component={RouletteGame} />
              <Route path="/game/plinko" component={Plinko} />

              {/* FAQ */}
              <Route path="/faq" component={FAQ} />

              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <CurrencyProvider>
        <BetSlipProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </BetSlipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
