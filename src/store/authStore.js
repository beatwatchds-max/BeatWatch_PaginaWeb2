import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const AUTH_STORAGE_KEY = 'beatwatch-auth'

const ROLE_ALIASES = Object.freeze({
  administrador: 'administrador',
  administrator: 'administrador',
  admin: 'administrador',
  paciente: 'paciente',
  patient: 'paciente',
  cuidador: 'cuidador',
  caregiver: 'cuidador',
})

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((part) => !part)) return null

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded))
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null
  } catch {
    return null
  }
}

export function normalizeRole(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeRole(item)
      if (normalized) return normalized
    }
    return null
  }

  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

  if (!normalized) return null

  if (ROLE_ALIASES[normalized]) return ROLE_ALIASES[normalized]
  if (normalized.includes('admin')) return 'administrador'
  if (normalized.includes('cuidador') || normalized.includes('caregiver')) return 'cuidador'
  if (normalized.includes('paciente') || normalized.includes('patient')) return 'paciente'

  return null
}

function roleFromObject(value) {
  if (!value || typeof value !== 'object') return null

  const directCandidates = [
    value.rol,
    value.role,
    value.roles,
    value.tipoUsuario,
    value.tipo_usuario,
  ]

  for (const candidate of directCandidates) {
    const role = normalizeRole(candidate)
    if (role) return role
  }

  for (const [key, candidate] of Object.entries(value)) {
    if (key.toLowerCase().endsWith('/role')) {
      const role = normalizeRole(candidate)
      if (role) return role
    }
  }

  return null
}

export function getSessionRole(user, token) {
  return roleFromObject(user) || roleFromObject(decodeJwtPayload(token))
}

export function isTokenUsable(token) {
  const payload = decodeJwtPayload(token)
  if (!payload) return false

  // El frontend no valida la firma del JWT; eso siempre corresponde al backend.
  // Aquí sólo se rechazan tokens malformados o fuera de su ventana temporal.
  const exp = Number(payload.exp)
  if (!Number.isFinite(exp)) return false

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (exp <= nowSeconds) return false

  if (payload.nbf !== undefined) {
    const nbf = Number(payload.nbf)
    if (!Number.isFinite(nbf) || nbf > nowSeconds) return false
  }

  return true
}

export function hasAllowedRole(role, allowedRoles = []) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true
  const normalizedRole = normalizeRole(role)
  return allowedRoles.some((allowed) => normalizeRole(allowed) === normalizedRole)
}

const emptySession = {
  user: null,
  token: null,
  usuarioId: null,
  role: null,
  isAuthenticated: false,
}

const useAuthStore = create(
  persist(
    (set, get) => ({
      ...emptySession,
      isLoading: false,
      error: null,

      setSession: ({ user, token, usuarioId = null }) => {
        if (!isTokenUsable(token)) {
          throw new Error('El servidor devolvió una sesión inválida o expirada')
        }

        set({
          user: user || null,
          token,
          usuarioId,
          role: getSessionRole(user, token),
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
      },

      logout: () => {
        set({ ...emptySession, isLoading: false, error: null })
      },

      checkAuth: () => {
        const { token, user } = get()

        if (!isTokenUsable(token)) {
          set({ ...emptySession, isLoading: false, error: null })
          return false
        }

        set({
          role: getSessionRole(user, token),
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
        return true
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        usuarioId: state.usuarioId,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

export default useAuthStore
