import { useEffect, useState } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { api } from './lib/api.js'
import { DEFAULT_SETTINGS } from '../supabase/functions/_shared/pricing.js'
import { CustomerShell } from './components/ui.jsx'
import Splash from './components/Splash.jsx'
import Home from './pages/Home.jsx'
import Enquire from './pages/Enquire.jsx'
import EnquiryStatus from './pages/EnquiryStatus.jsx'
import Plans from './pages/Plans.jsx'
import PlanStatus from './pages/PlanStatus.jsx'
import Review from './pages/Review.jsx'
import Policies from './pages/Policies.jsx'
import Account from './pages/Account.jsx'
import Admin from './pages/admin/Admin.jsx'
import CleanerApp from './pages/cleaner/CleanerApp.jsx'

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {})
  }, [])

  const customer = (el) => <CustomerShell settings={settings}>{el}</CustomerShell>

  return (
    <HashRouter>
      <Splash />
      <Routes>
        <Route path="/" element={customer(<Home settings={settings} />)} />
        <Route path="/enquire" element={customer(<Enquire settings={settings} />)} />
        <Route path="/enquiry/:token" element={customer(<EnquiryStatus settings={settings} />)} />
        <Route path="/plans" element={customer(<Plans settings={settings} />)} />
        <Route path="/plan/:token" element={customer(<PlanStatus settings={settings} />)} />
        <Route path="/review/:token" element={customer(<Review settings={settings} />)} />
        <Route path="/policies" element={customer(<Policies settings={settings} />)} />
        <Route path="/account" element={customer(<Account />)} />
        <Route path="/admin/*" element={<Admin settings={settings} onSettings={setSettings} />} />
        <Route path="/cleaner/*" element={<CleanerApp settings={settings} />} />
        <Route path="*" element={customer(<Home settings={settings} />)} />
      </Routes>
    </HashRouter>
  )
}
