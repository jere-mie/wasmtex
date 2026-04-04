import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { FileProvider } from '@/context/FileContext'
import { ThemeProvider } from '@/context/ThemeContext'
import '@/styles/globals.css'
import App from './App.tsx'

const browserGlobals = globalThis as typeof globalThis & { Buffer?: typeof Buffer }

if (!browserGlobals.Buffer) {
  browserGlobals.Buffer = Buffer
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <FileProvider>
        <App />
      </FileProvider>
    </ThemeProvider>
  </StrictMode>,
)
