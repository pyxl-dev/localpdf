import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </HashRouter>
  </StrictMode>,
)
