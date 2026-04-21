import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err)
})

pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL')
})

export default pool
