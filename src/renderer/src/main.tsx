import '@renderer/assets/main.css'
import { createRoot } from 'react-dom/client'
import Browser from '@renderer/window/browser/browser'
//import { LicenseManager } from 'ag-grid-enterprise'

createRoot(document.getElementById('root')!).render(<Browser />)
