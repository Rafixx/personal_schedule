import { Outlet } from 'react-router-dom'
import { Sidebar } from '../shared/components/organisms/Sidebar'

export const DashboardLayout = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 bg-gray-50 overflow-auto">
        <header className="bg-white shadow p-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">CALENDARIO DE COMIDAS</h1>
          <div className="flex items-center gap-4 bg-gray-100 rounded-lg">
            <div
              data-testid="username-display"
              className="flex items-center gap-6 px-3 py-2 bg-secondary/30 rounded-md shadow-sm"
            ></div>
          </div>
        </header>
        <section className="p-6">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
