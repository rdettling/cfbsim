import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { newRouteElements } from './app/router';
import { legacyRouteElements } from './legacy/legacyRoutes';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {newRouteElements}
        {legacyRouteElements}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
