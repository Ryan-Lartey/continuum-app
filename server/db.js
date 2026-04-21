import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg

const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false

function makePool(schema) {
  const base = process.env.DATABASE_URL || ''
  // Append search_path via connection options
  const sep = base.includes('?') ? '&' : '?'
  const url = `${base}${sep}options=-c%20search_path%3D${schema}`
  return new Pool({ connectionString: url, ssl })
}

const realPool = makePool('public')
const demoPool = makePool('demo')

realPool.on('error', (err) => console.error('[DB] Real pool error', err))
demoPool.on('error', (err) => console.error('[DB] Demo pool error', err))

let _demoMode = false

export function setDemoMode(val) { _demoMode = val }
export function getDemoMode() { return _demoMode }

const pool = {
  query: (...args) => (_demoMode ? demoPool : realPool).query(...args),
}

export default pool
