import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { api } from './lib/api.js'
import { DEFAULT_SETTINGS } from '../supabase/functions/_shared/pricing.js'
import { CustomerShell } from './components/ui.jsx'
import Home from './pages/Home.jsx'
import Enquire from './pages/Enquire.jsx'
import EnquiryStatus from './pages/EnquiryStatus.jsx'
import Plans from './pages/Plans.jsx'
import PlanStatus from './pages/PlanStatus.jsx'
import Admin from './pages/admin/Admin.jsx'

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {})
  }, [])

  const customer = (el) => <CustomerShell settings={settings}>{el}</CustomerShell>

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={customer(<Home settings={settings} />)} />
        <Route path="/enquire" element={customer(<Enquire settings={settings} />)} />
        <Route path="/enquiry/:token" element={customer(<EnquiryStatus />)} />
        <Route path="/plans" element={customer(<Plans settings={settings} />)} />
        <Route path="/plan/:token" element={customer(<PlanStatus />)} />
        <Route path="/admin/*" element={<Admin settings={settings} onSettings={setSettings} />} />
        <Route path="*" element={customer(<Home settings={settings} />)} />
      </Routes>
    </HashRouter>
  )
}
