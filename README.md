# 📅 Personal Schedule – Calendario de Comidas

**Personal Schedule** es una aplicación web construida con **React + TypeScript + Vite** que permite planificar comidas semanales y generar automáticamente la lista de la compra.  
Funciona completamente en el navegador gracias a **IndexedDB (Dexie)**: no necesita servidor ni conexión a internet.

---
## 🚀 Funcionalidades
---
- Planificación semanal de comidas (lunes a viernes).
- Asignar, cambiar, eliminar o mover platos entre días (drag & drop).
- Catálogo de platos disponibles.
- Generación de lista de la compra consolidada.
- Exportación / importación de datos en JSON (backup/restore).
- Persistencia local en navegador (IndexedDB).

---
## 🗂️ Estructura
---
src/
├─ components/ # UI reutilizable (PlannerView, DayCell, Toolbar...)
├─ data/ # IndexedDB con Dexie (db.ts, repositories.ts, demo.ts)
├─ domain/ # Lógica de negocio (tipos, computeShoppingList)
├─ layouts/ # Layouts principales (DashboardLayout)
├─ pages/ # Páginas (PlannerPage, DishesPage, ShoppingListPage)
├─ shared/ # Sidebar, rutas, utils
├─ store/ # Estado global con Zustand
└─ main.tsx # Entrada de la SPA con React Router

---
## ⚙️ Scripts
---
bash
npm run dev       # Inicia servidor de desarrollo
npm run build     # Construye versión de producción
npm run preview   # Previsualiza build
npm run test      # Ejecuta tests
npm run lint      # Linter

---
▶️ Ejecución local
---
git clone https://github.com/Rafixx/personal_schedule.git
cd personal_schedule
npm install
npm run dev
Abrir http://localhost:5173
en el navegador.

---
🛠️ Tecnologías
---
React + Vite
TypeScript
Zustand
Dexie (IndexedDB)
TailwindCSS
@dnd-kit
Lucide-react
