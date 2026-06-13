import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { compatibilityRouteElements, primaryRouteElements } from './app/router';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {primaryRouteElements}
        {compatibilityRouteElements}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
