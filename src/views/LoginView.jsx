import { useState } from 'react'
import { setAuth } from '../lib/auth.js'

const BASE = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? `${__API_URL__}/api` : '/api'

export default function LoginView({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      setAuth(data.token, data.role, data.name)
      onLogin(data.role, data.name)
    } catch {
      setError('Unable to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 30% 20%, rgba(249,115,22,0.06) 0%, transparent 60%), var(--bg-page)',
      }}
    >
      <div
        style={{
          width: 360,
          background: 'rgba(17,17,20,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Accent line */}
        <div style={{ height: 2, background: 'linear-gradient(90deg, #f97316 0%, rgba(249,115,22,0.15) 60%, transparent 100%)' }} />

        <div style={{ padding: '32px 32px 28px' }}>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(249,115,22,0.3)',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L11 4V8L6 11L1 8V4L6 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="6" cy="6" r="1.5" fill="white"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>Continuum</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Operations Intelligence</div>
            </div>
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 24 }}>Enter your credentials to continue</div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 6 }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 10,
                  color: 'var(--text-1)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 10,
                  color: 'var(--text-1)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.4)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
              />
            </div>

            {error && (
              <div style={{
                padding: '9px 12px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                fontSize: 12,
                color: '#f87171',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              style={{
                marginTop: 4,
                width: '100%',
                padding: '11px',
                background: loading ? 'rgba(249,115,22,0.4)' : 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
                border: 'none',
                borderRadius: 10,
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(249,115,22,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
                transition: 'opacity 0.15s',
                opacity: (!username.trim() || !password) ? 0.5 : 1,
              }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
