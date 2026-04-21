// Statistical Process Control calculations (I-MR chart)
export function calcSPC(values) {
  if (!values || values.length < 2) return null

  const n = values.length
  const xBar = values.reduce((a, b) => a + b, 0) / n

  const movingRanges = values.slice(1).map((v, i) => Math.abs(v - values[i]))
  const rBar = movingRanges.reduce((a, b) => a + b, 0) / movingRanges.length

  const d2 = 1.128 // constant for n=2 subgroup (I-MR)
  const D3 = 0     // lower control limit factor for MR
  const D4 = 3.267 // upper control limit factor for MR

  const sigma = rBar / d2
  const ucl = xBar + 3 * sigma
  const lcl = xBar - 3 * sigma
  const uclMR = D4 * rBar
  const lclMR = D3 * rBar

  // Signal detection
  const signals = new Array(n).fill(false)

  // Rule 1: Beyond control limits
  values.forEach((v, i) => {
    if (v > ucl || v < lcl) signals[i] = true
  })

  // Rule 2: 8 consecutive on same side of centre line
  for (let i = 7; i < n; i++) {
    const window = values.slice(i - 7, i + 1)
    if (window.every(v => v > xBar) || window.every(v => v < xBar)) {
      for (let j = i - 7; j <= i; j++) signals[j] = true
    }
  }

  // MR signals
  const mrSignals = movingRanges.map(mr => mr > uclMR)

  return {
    xBar,
    ucl,
    lcl,
    rBar,
    uclMR,
    lclMR,
    sigma,
    signals,
    mrSignals,
    movingRanges,
    hasSignal: signals.some(Boolean),
  }
}

export function interpretSignal(spc, metricLabel) {
  if (!spc) return null
  if (!spc.hasSignal) {
    return {
      type: 'stable',
      title: 'Process is Stable',
      text: `${metricLabel} shows common cause variation only — all data points fall within the control limits (UCL: ${spc.ucl.toFixed(1)}, LCL: ${Math.max(spc.lcl, 0).toFixed(1)}).\n\nWhat this means operationally: The process is predictable. The day-to-day variation you see is normal and expected — not caused by anything specific.\n\nWhat to do: Your process is predictable. Focus improvement efforts on shifting the average (X̄ = ${spc.xBar.toFixed(2)}) closer to target, not reducing variation. Investigate and eliminate common causes systematically if the average is off-target.`,
    }
  }

  const signalCount = spc.signals.filter(Boolean).length
  const mrSignalCount = spc.mrSignals.filter(Boolean).length
  const extraContext = mrSignalCount > 0
    ? ` The Moving Range chart also shows ${mrSignalCount} unusually large day-to-day jump${mrSignalCount > 1 ? 's' : ''}, confirming something shifted abruptly.`
    : ''

  return {
    type: 'signal',
    title: 'Special Cause Signal Detected',
    text: `${metricLabel} has ${signalCount} signal point${signalCount > 1 ? 's' : ''} outside the control limits (UCL: ${spc.ucl.toFixed(1)}, CL: ${spc.xBar.toFixed(1)}, LCL: ${Math.max(spc.lcl, 0).toFixed(1)}).${extraContext}\n\nWhat this means operationally: A signal does NOT automatically mean something went wrong — it means something CHANGED. The process behaved differently on those dates in a way that cannot be explained by normal variation.\n\nWhat to do: Investigate what changed on the signal dates. Ask — Did headcount or staffing change? Different process, equipment, or shift pattern? New starter or team rotation? External factor (weather, volume spike)? Find the root cause, then either fix it (if bad) or replicate it everywhere (if good).`,
  }
}
