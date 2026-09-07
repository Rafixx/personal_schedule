import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './test/mswServer'
import App from './App'

const API_URL = 'https://script.example.com/exec'

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
    await userEvent.click(await screen.findByRole('button', { name: /gazpacho/i }))
    await waitFor(() => expect(screen.queryByText('Elegir plato · Primero')).not.toBeInTheDocument())
    await waitFor(() => expect(accionRecibida).toBe('plan.set'))
  })
})
