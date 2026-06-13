import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { primaryRouteElements } from './app/router';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {primaryRouteElements}
      </Routes>
    </BrowserRouter>
  );
};

export default App;
