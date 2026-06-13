import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { compatibilityRouteElements, primaryRouteElements } from './app/router';
import { buildLegacyRouteElements } from './legacy/legacyRoutes';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {primaryRouteElements}
        {compatibilityRouteElements}
        {buildLegacyRouteElements('/legacy')}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
