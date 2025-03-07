import { BrowserRouter } from "react-router-dom";
import { Routes, Route } from "react-router-dom";
import Footer from "./components/Footer";
import Box from "@mui/material/Box";
import Home from "./pages/Home";
import { NonCon } from "./pages/Noncon";
import Dashboard from "./pages/Dashboard";
import Schedule from "./pages/Schedule";
import Rankings from "./pages/Rankings";
import Playoff from "./pages/Playoff";
import Standings from "./pages/Standings";
import Roster from "./pages/Roster";
import TeamHistory from "./pages/TeamHistory";
import Player from "./pages/Player";
import WeekSchedule from "./pages/WeekSchedule";
import GamePreview from "./pages/GamePreview";
import TeamStats from "./pages/TeamStats";
import IndividualStats from "./pages/IndividualStats";
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
            <Route path="/:teamName/schedule" element={<Schedule />} />
            <Route path="/:teamName/roster" element={<Roster />} />
            <Route path="/:teamName/history" element={<TeamHistory />} />
            <Route path="/playoff" element={<Playoff />} />
            <Route path="/standings/:conference_name" element={<Standings />} />
            <Route path="/players/:playerId" element={<Player />} />
            <Route path="/schedule/:week" element={<WeekSchedule />} />
            <Route path="/game/:id" element={<GamePreview />} />
            <Route path="stats/team" element={<TeamStats />} />
            <Route path="stats/individual" element={<IndividualStats />} />
          </Routes>
        </Box>
        <Footer />
      </Box>
    </BrowserRouter>
  );
};

export default App;
