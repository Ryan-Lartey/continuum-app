import { useState, useEffect } from 'react'
import SideNav from './components/SideNav.jsx'
import AgentPanel from './components/AgentPanel.jsx'
import HomeView from './views/HomeView.jsx'
import FloorView from './views/FloorView.jsx'
import ProjectsView from './views/ProjectsView.jsx'
import PortfolioListView from './views/PortfolioListView.jsx'
import PortfolioView from './views/PortfolioView.jsx'
import DataView from './views/DataView.jsx'
import ReportsView from './views/ReportsView.jsx'
import ProcessMapsView from './views/ProcessMapsView.jsx'
import { api, setApiDemoMode } from './lib/api.js'
import GlobalSearch from './components/GlobalSearch.jsx'

export default function App() {
  const [view, setView] = useState('home')
  const [agentOpen, setAgentOpen] = useState(null)
  const [openProject, setOpenProject] = useState(null)
  const [openPortfolio, setOpenPortfolio] = useState(null)
  const [signals, setSignals] = useState([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [demoMode, setDemoMode] = useState(() => {
    const saved = localStorage.getItem('continuum_demo_mode') === 'true'
    setApiDemoMode(saved)
    return saved
  })

  useEffect(() => {
    api.getLatestKpis().then(kpis => {
      setSignals(Object.entries(kpis).filter(([, v]) => v?.signal).map(([k]) => k))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.metaKey && e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function toggleDemoMode() {
    const next = !demoMode
    localStorage.setItem('continuum_demo_mode', String(next))
    setApiDemoMode(next)
    if (next) {
      const today = new Date().toISOString().split('T')[0]
      localStorage.setItem(`continuum_headcount_${today}`, JSON.stringify({ inbound: 48, outbound: 62, pick: 74 }))
    }
    window.location.reload()
  }

  function handleOpenAgent(agentId, initialMessage) {
    setAgentOpen({ id: agentId, message: initialMessage })
  }

  function handleNavigate(viewId, project) {
    if (project) setOpenProject(project)
    setView(viewId)
  }

  async function handleOpenPortfolio(portfolioId) {
    const portfolio = await api.getPortfolio(portfolioId).catch(() => null)
    if (portfolio) {
      setOpenPortfolio(portfolio)
      setView('portfolio')
    }
  }

  const viewProps = {
    onOpenAgent: handleOpenAgent,
    onNavigate: handleNavigate,
    onOpenPortfolio: handleOpenPortfolio,
    demoMode,
    onKpiLogged: () => {
      api.getLatestKpis().then(kpis => {
        setSignals(Object.entries(kpis).filter(([, v]) => v?.signal).map(([k]) => k))
      }).catch(() => {})
    },
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'radial-gradient(ellipse 100% 60% at 20% 0%, rgba(249,115,22,0.035) 0%, transparent 50%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99,102,241,0.025) 0%, transparent 50%), var(--bg-page)' }}>
      <SideNav
        active={view}
        onChange={(v) => { setView(v); setOpenProject(null); setOpenPortfolio(null) }}
        onOpenAgent={handleOpenAgent}
        onKpiLogged={viewProps.onKpiLogged}
        onObsLogged={() => {}}
        signals={signals}
        demoMode={demoMode}
        onToggleDemo={toggleDemoMode}
      />

      <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.2), transparent)', flexShrink: 0 }} />
        {demoMode && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.04) 100%)',
            borderBottom: '1px solid rgba(249,115,22,0.2)',
            padding: '8px 24px',
            fontSize: 12,
            color: '#fb923c',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <span>🎭</span>
            <span><strong>Presentation Mode</strong> — showing 3 months of demo data. Your real data is safe.</span>
            <button onClick={toggleDemoMode} style={{ marginLeft: 'auto', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '6px', padding: '3px 10px', fontSize: 11, color: '#fb923c', cursor: 'pointer' }}>
              Exit Demo
            </button>
          </div>
        )}
        <div className="p-7 flex-1">
          {view === 'home'      && <HomeView     {...viewProps} />}
          {view === 'floor'     && <FloorView    {...viewProps} />}
          {view === 'projects'  && <ProjectsView {...viewProps} openProject={openProject} />}
          {view === 'portfolio' && !openPortfolio && (
            <PortfolioListView onOpenPortfolio={p => setOpenPortfolio(p)} />
          )}
          {view === 'portfolio' && openPortfolio && (
            <PortfolioView
              portfolio={openPortfolio}
              onBack={() => setOpenPortfolio(null)}
              onNavigate={handleNavigate}
              demoMode={demoMode}
            />
          )}
          {view === 'data'          && <DataView        {...viewProps} />}
          {view === 'reports'       && <ReportsView     {...viewProps} />}
          {view === 'process-maps'  && <ProcessMapsView {...viewProps} />}
        </div>
      </main>

      <GlobalSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
        onOpenProject={(p) => handleNavigate('projects', p)}
        onOpenPortfolio={handleOpenPortfolio}
      />

      {agentOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setAgentOpen(null)} />
          <AgentPanel
            agentId={agentOpen.id}
            initialMessage={agentOpen.message}
            onClose={() => setAgentOpen(null)}
            projectContext={null}
          />
        </>
      )}
    </div>
  )
}
