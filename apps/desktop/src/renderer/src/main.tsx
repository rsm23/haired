import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

declare global {
  interface Window {
    __hairedDesktopRoot?: ReturnType<typeof ReactDOM.createRoot>
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Haired desktop root is missing')
window.__hairedDesktopRoot ??= ReactDOM.createRoot(rootElement)
window.__hairedDesktopRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
