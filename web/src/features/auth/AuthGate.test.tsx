import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { borrarSesion, guardarSesion } from '../../data/session'
import { AuthGate } from './AuthGate'

const API_URL = 'https://script.example.com/exec'

afterEach(() => {
  borrarSesion()
})

function Contenido() {
  return (
    <div>
      <nav aria-label="Navegación principal">Nav real</nav>
      <p>Contenido protegido</p>
    </div>
  )
}

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Contenido />
      </AuthGate>
    </QueryClientProvider>
  )
}

describe('AuthGate', () => {
  it('sin sesión, muestra el login y no la navegación principal', async () => {
    server.use(
      http.get(API_URL, () => HttpResponse.json({ ok: true, usuarios: [{ id_usuario: 1, nombre: 'Rafa' }] }))
    )
    renderGate()
    expect(await screen.findByText('¿Quién eres?')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument()
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
  })

  it('con sesión sembrada, muestra el contenido y la navegación principal', () => {
    guardarSesion({ token: 't1', idUsuario: 1, nombre: 'Ana' })
    renderGate()
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
    expect(screen.queryByText('¿Quién eres?')).not.toBeInTheDocument()
  })
})
