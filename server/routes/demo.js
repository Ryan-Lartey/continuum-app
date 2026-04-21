import express from 'express'
import { setDemoMode, getDemoMode } from '../db.js'

const router = express.Router()

router.get('/status', (req, res) => {
  res.json({ demoMode: getDemoMode() })
})

router.post('/toggle', (req, res) => {
  const next = !getDemoMode()
  setDemoMode(next)
  console.log(`[Demo] Mode ${next ? 'ON' : 'OFF'}`)
  res.json({ demoMode: next })
})

export default router
