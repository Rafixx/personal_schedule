import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Planner from './routes/Planner';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Planner />} />
      </Routes>
    </BrowserRouter>
  );
}
