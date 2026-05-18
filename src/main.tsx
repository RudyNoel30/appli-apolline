import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './auth/AuthContext'
import ThemeProvider from './theme/ThemeProvider'
import App from './App'
import './index.css'


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
          <Toaster
            // top-center : visible peu importe le contexte (modal portal,
            // sheets full-screen…). bottom-right était caché par les footers
            // des modaux DossierEditor / PretEditor → Sébastien ne voyait pas
            // les "Prénom et nom obligatoires" et croyait que le bouton "Créer
            // le dossier" ne faisait rien (en réalité validation rejetée).
            position="top-center"
            theme="light"
            richColors
            closeButton
            // z-index au-dessus de tous les portals (modals/sheets sont à z-50)
            style={{ zIndex: 100 }}
            toastOptions={{
              style: {
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '13px',
              },
            }}
          />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
