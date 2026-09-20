import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { fechasSemana, lunesDe } from '../../shared/semanaDates'
import { ShoppingListPage } from './ShoppingListPage'

const API_URL = 'https://script.example.com/exec'
const fechaHoy = fechasSemana(lunesDe(new Date()))[0]

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/compra']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function mockApi(
  entries: Array<{ fecha: string; [clave: string]: unknown }>,
  marcasPorSemana: Record<string, unknown[]> = {}
) {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      const action = url.searchParams.get('action')
      if (action === 'bootstrap') {
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
      if (action === 'compra') {
        const semana = url.searchParams.get('semana') ?? ''
        return HttpResponse.json({ ok: true, marcas: marcasPorSemana[semana] ?? [] })
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
    // "Sin conexión" también aparece en el SyncPill cuando hay error, así que
    // se busca el texto completo del aviso para no chocar con las dos coincidencias.
    server.use(http.get(API_URL, () => HttpResponse.json({ ok: false, error: 'fallo' }, { status: 500 })))
    render(<ShoppingListPage />, { wrapper })
    expect(await screen.findByText(/sin conexión — no se pudo cargar la lista de la compra/i)).toBeInTheDocument()
  })

  it('cambiar a la semana que viene recalcula la lista', async () => {
    mockApi([{ id: 1, fecha: fechaHoy, turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    render(<ShoppingListPage />, { wrapper })
    await screen.findByText('Mercadona')

    await userEvent.click(screen.getByRole('button', { name: /la semana que viene/i }))

    await waitFor(() => expect(screen.queryByText('Mercadona')).not.toBeInTheDocument())
    expect(await screen.findByText('No hay platos planificados para esta semana.')).toBeInTheDocument()
  })

  it('marcar un ingrediente como comprado envía compra.marcar y el checkbox queda marcado tras refrescar', async () => {
    // El GET tras invalidar (onSettled, y también el que dispara "Actualizar
    // datos") debe ver la marca ya persistida, como haría el backend real.
    const marcasPorSemana: Record<string, unknown[]> = {}
    mockApi([{ id: 1, fecha: fechaHoy, turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }], marcasPorSemana)
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as {
          payload: { semana: string; id_ingrediente: number; unidad: string; comprado: boolean }
        }
        payloadRecibido = body
        marcasPorSemana[body.payload.semana] = body.payload.comprado
          ? [{ id: 1, semana: body.payload.semana, id_ingrediente: body.payload.id_ingrediente, unidad: body.payload.unidad }]
          : []
        return HttpResponse.json({ ok: true, result: { comprado: body.payload.comprado } })
      })
    )
    render(<ShoppingListPage />, { wrapper })
    const checkbox = await screen.findByRole('checkbox', { name: /tomate/i })
    expect(checkbox).not.toBeChecked()

    await userEvent.click(checkbox)

    await waitFor(() => expect(checkbox).toBeChecked())
    expect(payloadRecibido).toMatchObject({
      action: 'compra.marcar',
      payload: { semana: fechaHoy, id_ingrediente: 1, unidad: 'g', comprado: true }
    })

    // Persiste al refrescar desde el servidor, no solo en el estado optimista.
    await userEvent.click(screen.getByRole('button', { name: /actualizar datos/i }))
    await waitFor(() => expect(checkbox).toBeChecked())
  })
})
