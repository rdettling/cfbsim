import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { NonCon } from './pages/Noncon';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/noncon" element={<NonCon />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:teamName/schedule" element={<Schedule />} />
      </Routes>
    </Router>
  );
}

export default App;