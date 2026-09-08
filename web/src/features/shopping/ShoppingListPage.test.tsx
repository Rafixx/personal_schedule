import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { fechasSemana, lunesDe } from '../../shared/semanaDates'
import { ShoppingListPage } from './ShoppingListPage'

const API_URL = 'https://script.example.com/exec'
const fechaHoy = fechasSemana(lunesDe(new Date()))[0]

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function mockApi(entries: Array<{ fecha: string; [clave: string]: unknown }>) {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'bootstrap') {
        return HttpResponse.json({
          ok: true,
          platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }],
          ingredientes: [
            {
              id_ingrediente: 1,
              nombre: 'Tomate',
              proveedor: 'Mercadona',
              unidad_base: 'g',
              temporada: 'TODAS',
              kcal_100: '',
              prot_100: '',
              carb_100: '',
              grasa_100: ''
            }
          ],
          ingredientesPlatos: [{ id: 1, id_plato: 1, id_ingrediente: 1, cantidad: 500, unidad: 'g' }],
          reglas: [],
          proveedores: [{ nombre: 'Mercadona', orden: 1 }]
        })
      }
      // La API real filtra por desde/hasta en el servidor; el mock reproduce ese
      // filtrado para que cambiar de rango (actual/siguiente) recalcule la lista.
      const desde = url.searchParams.get('desde')
      const hasta = url.searchParams.get('hasta')
      const entriesEnRango = entries.filter(
        (entrada) => (!desde || entrada.fecha >= desde) && (!hasta || entrada.fecha <= hasta)
      )
      return HttpResponse.json({ ok: true, entries: entriesEnRango })
    })
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ShoppingListPage', () => {
  it('muestra la lista de la semana actual agrupada por proveedor', async () => {
    mockApi([{ id: 1, fecha: fechaHoy, turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    render(<ShoppingListPage />, { wrapper })
    expect(await screen.findByText('Mercadona')).toBeInTheDocument()
    expect(screen.getByText('Tomate: 500 g')).toBeInTheDocument()
  })

  it('muestra un mensaje cuando no hay platos planificados', async () => {
    mockApi([])
    render(<ShoppingListPage />, { wrapper })
    await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument())
    expect(screen.getByText('No hay platos planificados para esta semana.')).toBeInTheDocument()
  })

  it('copiar al portapapeles envía el texto formateado', async () => {
    mockApi([{ id: 1, fecha: fechaHoy, turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    render(<ShoppingListPage />, { wrapper })
    await screen.findByText('Mercadona')
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('MERCADONA\n- Tomate: 500 g')
    expect(await screen.findByRole('button', { name: /copiado/i })).toBeInTheDocument()
  })

  it('muestra un aviso de conexión si la API falla', async () => {
    server.use(http.get(API_URL, () => HttpResponse.json({ ok: false, error: 'fallo' }, { status: 500 })))
    render(<ShoppingListPage />, { wrapper })
    expect(await screen.findByText(/sin conexión/i)).toBeInTheDocument()
  })

  it('cambiar a la semana que viene recalcula la lista', async () => {
    mockApi([{ id: 1, fecha: fechaHoy, turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    render(<ShoppingListPage />, { wrapper })
    await screen.findByText('Mercadona')

    await userEvent.click(screen.getByRole('button', { name: /la semana que viene/i }))

    await waitFor(() => expect(screen.queryByText('Mercadona')).not.toBeInTheDocument())
    expect(await screen.findByText('No hay platos planificados para esta semana.')).toBeInTheDocument()
  })
})
