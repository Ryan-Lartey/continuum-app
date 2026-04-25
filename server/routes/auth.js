import express from 'express'
import jwt from 'jsonwebtoken'

const router = express.Router()
const SECRET = process.env.JWT_SECRET || 'continuum-dev-secret-change-in-prod'

const USERS = [
  {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    role: 'admin',
    name: 'Admin',
  },
  {
    username: process.env.VIEWER_USERNAME || 'manager',
    password: process.env.VIEWER_PASSWORD || 'manager123',
    role: 'viewer',
    name: 'Manager',
  },
]

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  const user = USERS.find(u => u.username === username && u.password === password)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign(
    { username: user.username, role: user.role, name: user.name },
    SECRET,
    { expiresIn: '7d' }
  )
  res.json({ token, role: user.role, name: user.name })
})

router.get('/me', (req, res) => {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const user = jwt.verify(token, SECRET)
    res.json({ username: user.username, role: user.role, name: user.name })
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router
