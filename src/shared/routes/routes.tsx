import { createBrowserRouter } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { PlannerPage } from '@/pages/PlannerPage'
import { DishesPage } from '@/pages/DishesPage'
import { ShoppingListPage } from '@/pages/ShoppingListPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { path: 'planner', element: <PlannerPage /> },
      { path: 'dishes', element: <DishesPage /> },
      { path: 'shopping', element: <ShoppingListPage /> }
    ]
  }
])
