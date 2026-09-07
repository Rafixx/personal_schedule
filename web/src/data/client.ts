import { createSheetsClient } from './sheetsClient'

const baseUrl = import.meta.env.VITE_API_URL
const token = import.meta.env.VITE_API_TOKEN

if (!baseUrl || !token) {
  throw new Error('Faltan VITE_API_URL o VITE_API_TOKEN — revisa el fichero .env.local (ver .env.example).')
}

export const sheetsClient = createSheetsClient({ baseUrl, token })
