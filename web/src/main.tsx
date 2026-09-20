import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import './index.css'
import App from './App.tsx'
import { SesionInvalidaError } from './data/sheetsClient'
import { borrarSesion } from './data/session'
import { registrarMutationDefaults } from './data/mutationDefaults'

// Ante un token revocado o caducado (SesionInvalidaError, code:'UNAUTHENTICATED'
// desde la hoja), cerramos la sesión y vaciamos la caché una única vez aquí en
// vez de comprobarlo en cada query/mutación repartida por la app: la siguiente
// vez que se renderice algo que depende de la sesión, AuthGate ya no la
// encuentra y vuelve a mostrar el login.
function onErrorGlobal(error: unknown): void {
  if (error instanceof SesionInvalidaError) {
    borrarSesion()
    queryClient.clear()
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000
    }
  },
  queryCache: new QueryCache({ onError: onErrorGlobal }),
  mutationCache: new MutationCache({ onError: onErrorGlobal })
})

// Registrado antes de renderizar nada: si hay una mutación de "marcar
// comprado" pausada por falta de red que se rehidrata desde IndexedDB, debe
// encontrar aquí su mutationFn en cuanto se reconstruya.
registrarMutationDefaults(queryClient)

const persister = createAsyncStoragePersister({
  storage: {
    getItem: get,
    setItem: set,
    removeItem: del
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
      // Tras rehidratar la caché (incluidas las mutaciones pausadas por falta
      // de red), reenvía lo que quedó pendiente. Necesario para el caso en
      // que el dispositivo ya está online al recargar la página: al no haber
      // una transición offline→online, el resume automático de QueryClient
      // (suscrito a onlineManager) no se dispararía solo.
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>
)
