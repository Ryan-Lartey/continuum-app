import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg

// Supabase uses trusted CAs — rejectUnauthorized: true is safe and required for security.
// Never use rejectUnauthorized: false in production (disables certificate validation).
const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: 10,                 // max connections in pool (Supabase free tier supports ~20)
  idleTimeoutMillis: 30000, // close idle connections after 30s
  connectionTimeoutMillis: 2000, // fail fast if no connection available within 2s
}

const realPool = new Pool(poolConfig)
const _demoPool  = new Pool(poolConfig)

realPool.on('error', (err) => console.error('[DB] Real pool error', err))
_demoPool.on('error',  (err) => console.error('[DB] Demo pool error', err))

// Reliable search_path: acquire client, set path, run query, release
const demoPool = {
  query: async (...args) => {
    const client = await _demoPool.connect()
    try {
      await client.query('SET search_path TO demo')
      return await client.query(...args)
    } finally {
      client.release()
    }
  }
}

let _demoMode = false
export function setDemoMode(val) { _demoMode = val }
export function getDemoMode()    { return _demoMode }

const pool = {
  query: (...args) => (_demoMode ? demoPool : realPool).query(...args),
}

export default pool
