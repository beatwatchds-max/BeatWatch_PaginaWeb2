import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router'
import { BarChart3, Heart, LogOut, Menu, Smartphone, Users, X } from 'lucide-react'
import useAuthStore, { hasAllowedRole } from '../../store/authStore'

export default function DashboardLayout() {
  const logout = useAuthStore((state) => state.logout)
  const role = useAuthStore((state) => state.role)
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMobileMenuOpen(false)
    await logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/dashboard/graficas', label: 'Gráficas', icon: BarChart3 },
    { to: '/dashboard/dispositivos', label: 'Dispositivos', icon: Smartphone },
    { to: '/dashboard/usuarios', label: 'Usuarios', icon: Users, roles: ['administrador'] },
  ]

  const sidebar = (
    <>
      <div className="shrink-0 p-6 border-b border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-rose-500 flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="font-bold text-xl text-white">
              <span className="text-blue-400">BIT</span>
              <span className="text-rose-400">WATCH</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.filter((item) => hasAllowedRole(role, item.roles)).map((item) => {
            const Icon = item.icon

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 block ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 p-4 border-t border-slate-800 bg-slate-900">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 text-slate-400 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition-all duration-200"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Cerrar sesión
        </button>
        <div className="text-xs text-slate-500 mt-3 px-4">BitWatch Dashboard v1.0</div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-slate-100 overflow-x-hidden">
      {/* Sidebar de escritorio: fijo y siempre ocupa toda la altura de la ventana. */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 h-screen bg-slate-900 flex-col overflow-hidden">
        {sidebar}
      </aside>

      {/* Sidebar móvil. */}
      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú lateral"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 h-dvh bg-slate-900 flex-col overflow-hidden md:hidden">
            {sidebar}
          </aside>
        </>
      )}

      <div className="min-w-0 md:pl-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 flex justify-between items-center gap-4 py-4 md:py-5 px-4 md:px-8 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">Dashboard</h1>
          </div>

          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700">En línea</span>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
