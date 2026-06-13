import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { NewAppRoutes } from './app/router';
import { legacyRouteElements } from './legacy/legacyRoutes';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/__new/*" element={<NewAppRoutes />} />
        {legacyRouteElements}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
