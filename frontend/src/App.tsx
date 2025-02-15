import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Launch from './pages/Launch';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Launch />} />
      </Routes>
    </Router>
  );
}

export default App;