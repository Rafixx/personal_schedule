import { createSheetsClient } from './sheetsClient'
import { leerSesion } from './session'

const baseUrl = import.meta.env.VITE_API_URL

if (!baseUrl) {
  throw new Error('Falta VITE_API_URL — revisa el fichero .env.local (ver .env.example).')
}

export const sheetsClient = createSheetsClient({
  baseUrl,
  getToken: () => leerSesion()?.token ?? null
})
