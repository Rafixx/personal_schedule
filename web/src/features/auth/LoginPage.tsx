import { useState, type FormEvent } from 'react'
import { useLogin, useUsuarios, type Usuario } from '../../data/queries'
import { ApiError } from '../../data/sheetsClient'

const LARGO_PIN = 6

function mensajeError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'LOCKED_OUT') {
    const minutos = Math.max(1, Math.ceil((error.reintentarEnS ?? 60) / 60))
    return `Demasiados intentos. Inténtalo de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`
  }
  return 'Usuario o PIN incorrectos.'
}

export function LoginPage() {
  const usuarios = useUsuarios()
  const login = useLogin()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [pin, setPin] = useState('')

  function elegirUsuario(u: Usuario) {
    setUsuario(u)
    setPin('')
    login.reset()
  }

  function cambiarUsuario() {
    setUsuario(null)
    setPin('')
    login.reset()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!usuario || pin.length !== LARGO_PIN) return
    login.mutate(
      { idUsuario: usuario.id, pin, dispositivo: navigator.userAgent },
      { onError: () => setPin('') }
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg dark:bg-neutral-900">
        <h1 className="mb-1 text-center text-xl font-bold text-neutral-900 dark:text-neutral-50">
          Menú familiar
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {usuario ? `Hola, ${usuario.nombre}` : '¿Quién eres?'}
        </p>

        {!usuario && (
          <>
            {usuarios.isLoading && <p className="text-center text-neutral-500">Cargando…</p>}
            {usuarios.isError && (
              <p className="text-center text-sm text-amber-700 dark:text-amber-500">
                No se pudo cargar la lista de usuarios.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {usuarios.data?.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => elegirUsuario(u)}
                  className="rounded-xl bg-neutral-100 px-4 py-5 text-base font-semibold text-neutral-800 hover:bg-amber-500 hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-amber-500 dark:hover:text-neutral-900"
                >
                  {u.nombre}
                </button>
              ))}
            </div>
          </>
        )}

        {usuario && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <fieldset disabled={login.isPending} className="contents">
              <div>
                <label
                  htmlFor="login-pin"
                  className="mb-1 block text-center text-sm font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  PIN de 6 dígitos
                </label>
                <input
                  id="login-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={LARGO_PIN}
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, LARGO_PIN))}
                  className="w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-3 text-center text-2xl tracking-[0.5em] dark:border-neutral-600 dark:bg-neutral-800"
                />
              </div>

              {login.isError && (
                <p className="text-center text-sm text-red-600" role="alert">
                  {mensajeError(login.error)}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cambiarUsuario}
                  className="rounded-full px-4.5 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Cambiar
                </button>
                <button
                  type="submit"
                  disabled={pin.length !== LARGO_PIN}
                  className="flex-1 rounded-full bg-amber-500 px-4.5 py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
                >
                  {login.isPending ? 'Entrando…' : 'Entrar'}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  )
}
