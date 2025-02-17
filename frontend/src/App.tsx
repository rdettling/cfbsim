import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Launch from './pages/Home';
import { NonCon } from './pages/Noncon';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Launch />} />
        <Route path="/noncon" element={<NonCon />} />
      </Routes>
    </Router>
  );
}

export default App;