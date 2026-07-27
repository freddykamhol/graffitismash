import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Admin from './Admin.jsx'
import OrderAction from './OrderAction.jsx'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const Root = path === '/system/admin' ? Admin : path === '/system/order-action' ? OrderAction : App
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
