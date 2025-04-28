import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Removed DataProvider import

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Removed DataProvider wrapper */}
    <App />
  </StrictMode>,
)
