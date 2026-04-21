import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg

const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false

const realPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl })
const demoPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl })

realPool.on('error', (err) => console.error('[DB] Real pool error', err))
demoPool.on('error', (err) => console.error('[DB] Demo pool error', err))
realPool.on('connect', (client) => { client.query("SET search_path TO public") })
demoPool.on('connect', (client) => { client.query("SET search_path TO demo") })

let _demoMode = false

export function setDemoMode(val) { _demoMode = val }
export function getDemoMode() { return _demoMode }

// Drop-in replacement: all routes just use pool.query() as before
const pool = {
  query: (...args) => (_demoMode ? demoPool : realPool).query(...args),
}

export default pool
