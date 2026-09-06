import { createSheetsClient } from './sheetsClient'

export const sheetsClient = createSheetsClient({
  baseUrl: import.meta.env.VITE_API_URL,
  token: import.meta.env.VITE_API_TOKEN
})
