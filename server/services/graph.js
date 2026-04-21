// Microsoft Graph API client for Continuum Excel sync
// Credentials are loaded from site_profile.excel_config JSON column
// Fill in via Continuum Settings after Azure app registration

// ── Token cache ───────────────────────────────────────────────────────────────
let _tokenCache = null
let _tokenExpiry = 0

export async function getAccessToken(config) {
  if (_tokenCache && Date.now() < _tokenExpiry - 60000) return _tokenCache

  const { tenantId, clientId, clientSecret } = config
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph credentials not configured. Add them in Settings.')
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default'
  })

  const res = await fetch(url, { method: 'POST', body })
  const data = await res.json()
  if (data.error) throw new Error(`Auth failed: ${data.error_description}`)

  _tokenCache = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in * 1000)
  return _tokenCache
}

export async function uploadFileToOneDrive(config, fileBuffer, fileName) {
  const token = await getAccessToken(config)
  const { oneDrivePath = 'Continuum' } = config

  // Upload via Graph API — simple upload for files under 4MB
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${oneDrivePath}/${fileName}:/content`

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    body: fileBuffer
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OneDrive upload failed: ${res.status} ${err?.error?.message || ''}`)
  }

  const data = await res.json()
  return data.webUrl || null
}

export async function testConnection(config) {
  const token = await getAccessToken(config)
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Connection test failed')
  return await res.json()
}
