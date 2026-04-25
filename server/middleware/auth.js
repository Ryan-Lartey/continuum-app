import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'continuum-dev-secret-change-in-prod'

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Block write operations for viewer role
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Read-only access' })
  }
  next()
}
