import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import Footer from "./components/Footer";
import Box from "@mui/material/Box";
import Home from "./pages/Home";
import { NonCon } from "./pages/Noncon";
import Dashboard from "./pages/Dashboard";
import TeamSchedule from "./pages/TeamSchedule";
import Rankings from "./pages/Rankings";
import Playoff from "./pages/Playoff";
import Standings from "./pages/Standings";
import Roster from "./pages/Roster";
import TeamHistory from "./pages/TeamHistory";
import Player from "./pages/Player";
import WeekSchedule from "./pages/WeekSchedule";
import Game from "./pages/Game";
import TeamStats from "./pages/TeamStats";
import IndividualStats from "./pages/IndividualStats";
import SeasonSummary from "./pages/SeasonSummary";

const App = () => {
  return (
    <BrowserRouter>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/noncon" element={<NonCon />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/:teamName/schedule" element={<TeamSchedule />} />
            <Route path="/:teamName/roster" element={<Roster />} />
            <Route path="/:teamName/history" element={<TeamHistory />} />
            <Route path="/playoff" element={<Playoff />} />
            <Route path="/standings/:conference_name" element={<Standings />} />
            <Route path="/players/:playerId" element={<Player />} />
            <Route path="/schedule/:week" element={<WeekSchedule />} />
            <Route path="/game/:id" element={<Game />} />
            <Route path="stats/team" element={<TeamStats />} />
            <Route path="stats/individual" element={<IndividualStats />} />
            <Route path="/summary" element={<SeasonSummary />} />
          </Routes>
        </Box>
        <Footer />
      </Box>
    </BrowserRouter>
  );
};

export default App;
