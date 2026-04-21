import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg

const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false

const realPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl })
const _demoPool  = new Pool({ connectionString: process.env.DATABASE_URL, ssl })

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
