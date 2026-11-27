import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes/discovery.css'
import './themes/theme-scaffold.css'
import './themes/stargate.css'
import './themes/win95.css'
import './themes/winxp.css'
import './themes/liquid-glass.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
