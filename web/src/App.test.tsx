import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addWeeks } from 'date-fns'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from './test/mswServer'
import { formatearRangoSemana, lunesDe } from './shared/semanaDates'
import App from './App'

const API_URL = 'https://script.example.com/exec'

beforeEach(() => {
  // BrowserRouter lee la URL real de jsdom, que no se resetea entre tests del
  // mismo fichero: sin esto, un test que navega a /compra deja esa ruta activa
  // para el siguiente test.
  window.history.pushState({}, '', '/')
})

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

function mockBootstrapYPlan() {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'bootstrap') {
        return HttpResponse.json({
          ok: true,
          platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'TODAS', etiquetas: 'verdura', notas: '', activo: true }],
          ingredientes: [],
          ingredientesPlatos: [],
          reglas: [],
          proveedores: []
        })
      }
      return HttpResponse.json({ ok: true, entries: [] })
    })
  )
}

describe('App', () => {
  it('renderiza el planificador con el recetario y la semana vacía', async () => {
    mockBootstrapYPlan()
    renderApp()
    expect(await screen.findByText('Recetario')).toBeInTheDocument()
    expect(await screen.findByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /añadir/i }).length).toBeGreaterThan(0)
  })

  it('permite asignar un plato a un hueco vacío mediante el selector', async () => {
    mockBootstrapYPlan()
    let accionRecibida: string | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string }
        accionRecibida = body.action
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    renderApp()
    const botonesAñadir = await screen.findAllByRole('button', { name: /añadir/i })
    await userEvent.click(botonesAñadir[0])
    const dialogo = await screen.findByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: /gazpacho/i }))
    await waitFor(() => expect(screen.queryByText('Elegir plato · Primero')).not.toBeInTheDocument())
    await waitFor(() => expect(accionRecibida).toBe('plan.set'))
  })

  it('reinicia el buscador del selector al abrirlo para un hueco distinto', async () => {
    mockBootstrapYPlan()
    renderApp()
    const botonesAñadir = await screen.findAllByRole('button', { name: /añadir/i })
    await userEvent.click(botonesAñadir[0])
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByPlaceholderText('Buscar plato…'), 'gazp')
    expect(within(dialogo).getByPlaceholderText('Buscar plato…')).toHaveValue('gazp')
    await userEvent.click(within(dialogo).getByRole('button', { name: /cerrar/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const botonesAñadirTrasCierre = await screen.findAllByRole('button', { name: /añadir/i })
    await userEvent.click(botonesAñadirTrasCierre[1])
    const dialogoDos = await screen.findByRole('dialog')
    expect(within(dialogoDos).getByPlaceholderText('Buscar plato…')).toHaveValue('')
  })

  it('navega a la lista de la compra desde la barra de navegación', async () => {
    mockBootstrapYPlan()
    renderApp()
    await screen.findByText('Recetario')

    await userEvent.click(screen.getByRole('link', { name: /compra/i }))

    expect(await screen.findByRole('button', { name: /esta semana/i })).toBeInTheDocument()
    expect(screen.queryByText('Recetario')).not.toBeInTheDocument()
  })

  it('conserva la semana visible del planificador al navegar a la compra y volver', async () => {
    mockBootstrapYPlan()
    renderApp()
    await screen.findByText('Recetario')

    await userEvent.click(screen.getByRole('button', { name: /semana siguiente/i }))
    const rangoSiguiente = formatearRangoSemana(addWeeks(lunesDe(new Date()), 1))
    await screen.findByText(rangoSiguiente)

    await userEvent.click(screen.getByRole('link', { name: /compra/i }))
    await screen.findByRole('button', { name: /esta semana/i })

    await userEvent.click(screen.getByRole('link', { name: /planificador/i }))
    expect(await screen.findByText(rangoSiguiente)).toBeInTheDocument()
  })

  it('navega al catálogo desde la barra de navegación', async () => {
    mockBootstrapYPlan()
    renderApp()
    await screen.findByText('Recetario')

    await userEvent.click(screen.getByRole('link', { name: /catálogo/i }))

    expect(await screen.findByRole('tab', { name: 'Platos' })).toBeInTheDocument()
    expect(screen.queryByText('Recetario')).not.toBeInTheDocument()
  })
})
