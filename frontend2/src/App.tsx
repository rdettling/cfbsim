import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import { NonCon } from './pages/Noncon';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/noncon" element={<NonCon />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
