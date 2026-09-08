import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PlannerPage } from './features/planner/PlannerPage'
import type { VistaPlanner } from './features/planner/Toolbar'
import { ShoppingListPage } from './features/shopping/ShoppingListPage'
import { lunesDe } from './shared/semanaDates'

function App() {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [vista, setVista] = useState<VistaPlanner>('semana')

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlannerPage lunes={lunes} setLunes={setLunes} vista={vista} setVista={setVista} />} />
        <Route path="/compra" element={<ShoppingListPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
