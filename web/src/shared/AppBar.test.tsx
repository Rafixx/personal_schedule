import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import { borrarSesion, guardarSesion, leerSesion } from '../data/session'
import { AppBar } from './AppBar'

const API_URL = 'https://script.example.com/exec'

afterEach(() => {
  borrarSesion()
})

// useLogout (llamado internamente por AppBar) exige un QueryClient en
// contexto, aunque no se dispare ninguna mutación durante el test — de ahí
// el QueryClientProvider aquí, que antes de esta tarea no hacía falta.
function renderAppBar(children?: ReactNode, ruta = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <AppBar>{children}</AppBar>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AppBar', () => {
  it('muestra los enlaces de navegación y el contenido de la página', () => {
    renderAppBar(<span>Contenido de la página</span>)
    expect(screen.getByRole('link', { name: 'Planificador' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compra' })).toBeInTheDocument()
    expect(screen.getByText('Contenido de la página')).toBeInTheDocument()
  })

  it('marca "Compra" como activo cuando la ruta es /compra, y "Planificador" no', () => {
    renderAppBar(undefined, '/compra')
    expect(screen.getByRole('link', { name: 'Compra' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Planificador' })).not.toHaveAttribute('aria-current')
  })

  it('muestra el enlace a Catálogo', () => {
    renderAppBar()
    expect(screen.getByRole('link', { name: 'Catálogo' })).toBeInTheDocument()
  })

  it('muestra el nombre de la persona con sesión activa', () => {
    guardarSesion({ token: 't1', idUsuario: 1, nombre: 'Rafa' })
    renderAppBar()
    expect(screen.getByText('Rafa')).toBeInTheDocument()
  })

  it('no muestra ningún nombre si no hay sesión (caso defensivo, no debería darse tras AuthGate)', () => {
    renderAppBar()
    expect(screen.getByRole('button', { name: /salir/i })).toBeInTheDocument()
  })

  it('el botón Salir llama a auth.logout y borra la sesión local', async () => {
    guardarSesion({ token: 't1', idUsuario: 1, nombre: 'Rafa' })
    let accionRecibida: string | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string }
        accionRecibida = body.action
        return HttpResponse.json({ ok: true, result: { revocadas: 1 } })
      })
    )
    renderAppBar()

    await userEvent.click(screen.getByRole('button', { name: /salir/i }))

    await waitFor(() => expect(accionRecibida).toBe('auth.logout'))
    await waitFor(() => expect(leerSesion()).toBeNull())
  })
})
