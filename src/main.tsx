import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FileProvider } from '@/context/FileContext'
import '@/styles/globals.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FileProvider>
      <App />
    </FileProvider>
  </StrictMode>,
)
