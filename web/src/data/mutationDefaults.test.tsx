import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  hydrate,
  onlineManager,
  useMutation
} from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import {
  MARCAR_COMPRA_MUTATION_KEY,
  type MarcarCompraContext,
  type MarcarCompraInput,
  registrarMutationDefaults
} from './mutationDefaults'

const API_URL = 'https://script.example.com/exec'

// onlineManager es un singleton de módulo compartido por toda la suite —
// si un test lo deja en false, contaminaría archivos de test que se
// ejecuten después en el mismo proceso de Vitest.
afterEach(() => {
  onlineManager.setOnline(true)
})

function crearQueryClient(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  registrarMutationDefaults(queryClient)
  return queryClient
}

function wrapperCon(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function useMarcarCompraDesdeDefaults() {
  return useMutation<unknown, Error, MarcarCompraInput, MarcarCompraContext>({
    mutationKey: MARCAR_COMPRA_MUTATION_KEY
  })
}

describe('registrarMutationDefaults — ciclo offline (Step 3)', () => {
  it('marcar sin conexión se ve al instante, no llega ninguna petición hasta volver online, y entonces se reenvía con el payload original', async () => {
    const queryClient = crearQueryClient()
    queryClient.setQueryData(['compra', '2026-09-07'], [])

    let peticionesPost = 0
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        peticionesPost++
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { comprado: true } })
      })
    )

    // Sin conexión ANTES de disparar la mutación: si algo llegase a MSW pese a
    // esto, el test lo detectaría vía el contador de peticiones, no solo por
    // el nombre de la llamada a setOnline.
    onlineManager.setOnline(false)

    const { result } = renderHook(() => useMarcarCompraDesdeDefaults(), {
      wrapper: wrapperCon(queryClient)
    })

    result.current.mutate({ semana: '2026-09-07', idIngrediente: 3, unidad: 'g', comprado: true })

    // onMutate corre igualmente sin red: la marca optimista se ve al instante.
    await waitFor(() =>
      expect(queryClient.getQueryData(['compra', '2026-09-07'])).toEqual([
        { id: expect.any(Number), semana: '2026-09-07', idIngrediente: 3, unidad: 'g' }
      ])
    )
    await waitFor(() => expect(result.current.isPaused).toBe(true))

    // Ninguna petición ha llegado a MSW mientras se está offline.
    expect(peticionesPost).toBe(0)
    expect(payloadRecibido).toBeNull()

    onlineManager.setOnline(true)

    // Se reanuda sola (sin resumePausedMutations explícito: la mutación sigue
    // en memoria en el mismo QueryClient montado, que ya está suscrito a
    // onlineManager desde su mount()) y el POST llega con el payload original.
    await waitFor(() => expect(peticionesPost).toBe(1))
    expect(payloadRecibido).toMatchObject({
      action: 'compra.marcar',
      payload: { semana: '2026-09-07', id_ingrediente: 3, unidad: 'g', comprado: true }
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.isPaused).toBe(false)
  })
})

describe('registrarMutationDefaults — persistencia entre recargas (Step 4)', () => {
  it('una mutación pausada se incluye en dehydrate() (shouldDehydrateMutation por defecto = isPaused)', async () => {
    const queryClient = crearQueryClient()
    queryClient.setQueryData(['compra', '2026-09-07'], [])

    // No se registra ningún handler de POST a propósito: con
    // onUnhandledRequest: 'error' (test/setup.ts) el test fallaría de forma
    // ruidosa si, contra lo esperado, algo intentase disparar el POST — esta
    // prueba solo mira el estado pausado y su forma deshidratada, nunca
    // vuelve a poner el cliente online.
    onlineManager.setOnline(false)
    const { result } = renderHook(() => useMarcarCompraDesdeDefaults(), {
      wrapper: wrapperCon(queryClient)
    })
    result.current.mutate({ semana: '2026-09-07', idIngrediente: 3, unidad: 'g', comprado: true })
    await waitFor(() => expect(result.current.isPaused).toBe(true))

    // Sin pasar shouldDehydrateMutation: se confía en el default de la
    // librería (defaultShouldDehydrateMutation === mutation.state.isPaused),
    // el mismo que usa PersistQueryClientProvider si no se le indica lo
    // contrario en dehydrateOptions.
    const dehydratedState = dehydrate(queryClient)

    expect(dehydratedState.mutations).toHaveLength(1)
    expect(dehydratedState.mutations[0]).toMatchObject({
      mutationKey: MARCAR_COMPRA_MUTATION_KEY,
      state: expect.objectContaining({
        isPaused: true,
        status: 'pending',
        variables: { semana: '2026-09-07', idIngrediente: 3, unidad: 'g', comprado: true }
      })
    })
  })

  it('resumePausedMutations() reenvía, con el payload correcto, una mutación reconstruida desde un dehydrate() previo en un QueryClient nuevo (simulando una recarga de página)', async () => {
    // --- "Antes de recargar": un QueryClient con una mutación pausada. ---
    const queryClientAntesDeRecargar = crearQueryClient()
    queryClientAntesDeRecargar.setQueryData(['compra', '2026-09-07'], [])

    let peticionesPost = 0
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        peticionesPost++
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { comprado: true } })
      })
    )

    onlineManager.setOnline(false)
    const { result: resultAntes, unmount: unmountAntes } = renderHook(
      () => useMarcarCompraDesdeDefaults(),
      {
        wrapper: wrapperCon(queryClientAntesDeRecargar)
      }
    )
    resultAntes.current.mutate({
      semana: '2026-09-07',
      idIngrediente: 3,
      unidad: 'g',
      comprado: true
    })
    await waitFor(() => expect(resultAntes.current.isPaused).toBe(true))

    const dehydratedState = dehydrate(queryClientAntesDeRecargar)
    expect(dehydratedState.mutations).toHaveLength(1)

    // Simula que la pestaña/proceso "de antes de recargar" desaparece de
    // verdad: al recargar la página, todo lo que había en memoria (incluida
    // la suscripción de ese QueryClient a onlineManager) se pierde. Sin este
    // unmount, el mutation observer de queryClientAntesDeRecargar seguiría
    // vivo en este mismo proceso de test y se auto-reanudaría también al
    // volver online más abajo, mandando una segunda petición e invalidando
    // la comprobación de que la reanudación viene de resumePausedMutations()
    // sobre el cliente rehidratado.
    unmountAntes()

    // --- "Recarga de página": un QueryClient nuevo, vacío, sin conocer la
    // mutación en curso salvo por lo que trae dehydratedState (mutationKey +
    // state — nunca mutationFn, que no sobrevive a la serialización). Se
    // registran los defaults ANTES de hidratar, tal y como hace main.tsx
    // (registrarMutationDefaults se llama justo tras crear el QueryClient,
    // antes de montar PersistQueryClientProvider). ---
    const queryClientTrasRecargar = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    registrarMutationDefaults(queryClientTrasRecargar)
    hydrate(queryClientTrasRecargar, dehydratedState)

    const mutacionesRehidratadas = queryClientTrasRecargar.getMutationCache().getAll()
    expect(mutacionesRehidratadas).toHaveLength(1)
    expect(mutacionesRehidratadas[0].state.isPaused).toBe(true)
    expect(mutacionesRehidratadas[0].state.variables).toEqual({
      semana: '2026-09-07',
      idIngrediente: 3,
      unidad: 'g',
      comprado: true
    })

    // Seguimos offline y sin observadores React montados sobre este segundo
    // cliente (así es como llega una mutación rehidratada de IndexedDB antes
    // de que nada la reclame): igualmente no debe haber llegado ninguna
    // petición.
    expect(peticionesPost).toBe(0)

    // Esto es lo que hace el onSuccess de PersistQueryClientProvider en
    // main.tsx tras una rehidratación con éxito.
    onlineManager.setOnline(true)
    await queryClientTrasRecargar.resumePausedMutations()

    await waitFor(() => expect(peticionesPost).toBe(1))
    expect(payloadRecibido).toMatchObject({
      action: 'compra.marcar',
      payload: { semana: '2026-09-07', id_ingrediente: 3, unidad: 'g', comprado: true }
    })
  })
})
