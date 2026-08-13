import { Navigate } from 'react-router'
import useAuthStore, { hasAllowedRole } from '../../store/authStore'

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const role = useAuthStore((state) => state.role)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!hasAllowedRole(role, allowedRoles)) {
    return <Navigate to="/dashboard/graficas" replace />
  }

  return children
}
