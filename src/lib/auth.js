const TOKEN_KEY = 'continuum_auth_token'
const ROLE_KEY  = 'continuum_auth_role'
const NAME_KEY  = 'continuum_auth_name'

export function getToken()  { return localStorage.getItem(TOKEN_KEY) }
export function getRole()   { return localStorage.getItem(ROLE_KEY) }
export function getName()   { return localStorage.getItem(NAME_KEY) }
export function isAdmin()   { return getRole() === 'admin' }
export function isLoggedIn() { return !!getToken() }

export function setAuth(token, role, name) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ROLE_KEY, role)
  localStorage.setItem(NAME_KEY, name)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(NAME_KEY)
}
