import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { ItemCatalogProvider } from './context/ItemCatalogContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ItemCatalogProvider>
      <App />
    </ItemCatalogProvider>
    <Toaster position="top-center" richColors closeButton duration={4000} />
  </StrictMode>,
)
