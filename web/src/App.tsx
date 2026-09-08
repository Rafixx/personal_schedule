import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { NavBar } from './NavBar'
import { PlannerPage } from './features/planner/PlannerPage'
import { ShoppingListPage } from './features/shopping/ShoppingListPage'

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<PlannerPage />} />
        <Route path="/compra" element={<ShoppingListPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
