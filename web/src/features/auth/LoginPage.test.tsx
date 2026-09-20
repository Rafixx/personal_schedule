import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { borrarSesion, leerSesion } from '../../data/session'
import { LoginPage } from './LoginPage'

const API_URL = 'https://script.example.com/exec'

afterEach(() => {
  borrarSesion()
})

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>
  )
}

function mockUsuarios() {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'auth.usuarios') {
        return HttpResponse.json({
          ok: true,
          usuarios: [
            { id_usuario: 1, nombre: 'Rafa' },
            { id_usuario: 2, nombre: 'Lourdes' },
            { id_usuario: 3, nombre: 'Paula' },
            { id_usuario: 4, nombre: 'Laia' }
          ]
        })
      }
      return HttpResponse.json({ ok: false, code: 'UNKNOWN_ACTION', error: 'no mockeado' }, { status: 500 })
    })
  )
}

describe('LoginPage', () => {
  it('pinta los nombres que llegan del servidor, no una lista fija', async () => {
    mockUsuarios()
    renderLoginPage()
    expect(await screen.findByRole('button', { name: 'Rafa' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lourdes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Paula' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Laia' })).toBeInTheDocument()
  })

  it('al elegir un nombre, pide el PIN y al enviarlo manda id_usuario y pin', async () => {
    mockUsuarios()
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({
          ok: true,
          token: 'nuevo-token',
          usuario: { id_usuario: 1, nombre: 'Rafa' },
          id_sesion: 1
        })
      })
    )
    renderLoginPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Rafa' }))

    const campoPin = screen.getByLabelText(/pin/i)
    expect(campoPin).toHaveAttribute('type', 'password')
    expect(campoPin).toHaveAttribute('inputMode', 'numeric')
    expect(campoPin).toHaveAttribute('maxLength', '6')

    await userEvent.type(campoPin, '123456')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() =>
      expect(payloadRecibido).toMatchObject({
        action: 'auth.login',
        payload: { id_usuario: 1, pin: '123456' }
      })
    )
    await waitFor(() => expect(leerSesion()).toEqual({ token: 'nuevo-token', idUsuario: 1, nombre: 'Rafa' }))
  })

  it('muestra un mensaje genérico de credenciales incorrectas si el PIN falla', async () => {
    mockUsuarios()
    server.use(
      http.post(API_URL, () =>
        HttpResponse.json({ ok: false, code: 'INVALID_CREDENTIALS', error: 'usuario o PIN incorrectos' })
      )
    )
    renderLoginPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Rafa' }))
    await userEvent.type(screen.getByLabelText(/pin/i), '000000')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/usuario o pin incorrectos/i)).toBeInTheDocument()
  })

  it('muestra el mensaje de bloqueo con los minutos restantes ante LOCKED_OUT', async () => {
    mockUsuarios()
    server.use(
      http.post(API_URL, () =>
        HttpResponse.json({
          ok: false,
          code: 'LOCKED_OUT',
          error: 'demasiados intentos fallidos',
          reintentar_en_s: 125
        })
      )
    )
    renderLoginPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Rafa' }))
    await userEvent.type(screen.getByLabelText(/pin/i), '000000')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/3 minutos/i)).toBeInTheDocument()
  })

  it('deshabilita el formulario mientras la petición de login está en curso', async () => {
    mockUsuarios()
    let resolverPost: (() => void) | undefined
    server.use(
      http.post(API_URL, async () => {
        await new Promise<void>((resolve) => {
          resolverPost = resolve
        })
        return HttpResponse.json({
          ok: true,
          token: 't',
          usuario: { id_usuario: 1, nombre: 'Rafa' },
          id_sesion: 1
        })
      })
    )
    renderLoginPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Rafa' }))
    await userEvent.type(screen.getByLabelText(/pin/i), '123456')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(screen.getByLabelText(/pin/i)).toBeDisabled())
    expect(resolverPost).toBeDefined()

    resolverPost?.()
    await waitFor(() => expect(leerSesion()).not.toBeNull())
  })
})
