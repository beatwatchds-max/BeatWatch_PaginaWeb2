import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  XCircle,
} from 'lucide-react'
import useRegistrationStore from '../../store/registrationStore'
import registrationService from '../../services/registrationService'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getPasswordRules(password) {
  return [
    { label: 'Entre 8 y 64 caracteres', valid: password.length >= 8 && password.length <= 64 },
    { label: 'Al menos una mayúscula', valid: /[A-Z]/.test(password) },
    { label: 'Al menos una minúscula', valid: /[a-z]/.test(password) },
    { label: 'Al menos un número', valid: /\d/.test(password) },
    { label: 'Al menos un carácter especial', valid: /[^A-Za-z0-9\s]/.test(password) },
    { label: 'Sin espacios', valid: password.length > 0 && !/\s/.test(password) },
  ]
}

export default function StepPersonalData() {
  const navigate = useNavigate()
  const setUsuarioData = useRegistrationStore((state) => state.setUsuarioData)

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const validate = (name, value, currentForm = form) => {
    switch (name) {
      case 'nombre':
        if (!value.trim()) return 'El nombre es obligatorio'
        if (value.trim().length < 2) return 'Mínimo 2 caracteres'
        if (!/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+$/.test(value.trim())) return 'Solo letras y espacios'
        return ''
      case 'email':
        if (!value.trim()) return 'El correo es obligatorio'
        if (!emailRegex.test(value.trim())) return 'Formato de correo inválido'
        return ''
      case 'telefono':
        if (!value.trim()) return 'El teléfono es obligatorio'
        if (!/^\d{10}$/.test(value)) return 'Teléfono inválido (10 dígitos)'
        return ''
      case 'password':
        if (!value) return 'La contraseña es obligatoria'
        if (value.length < 8) return 'Debe tener mínimo 8 caracteres'
        if (value.length > 64) return 'Debe tener máximo 64 caracteres'
        if (/\s/.test(value)) return 'No debe contener espacios'
        if (!/[A-Z]/.test(value)) return 'Debe contener al menos una mayúscula'
        if (!/[a-z]/.test(value)) return 'Debe contener al menos una minúscula'
        if (!/\d/.test(value)) return 'Debe contener al menos un número'
        if (!/[^A-Za-z0-9\s]/.test(value)) return 'Debe contener al menos un carácter especial'
        return ''
      case 'confirmPassword':
        if (!value) return 'Confirma tu contraseña'
        if (value !== currentForm.password) return 'Las contraseñas no coinciden'
        return ''
      default:
        return ''
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    let formattedValue = value

    if (name === 'nombre') {
      formattedValue = value.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').slice(0, 60)
    } else if (name === 'telefono') {
      formattedValue = value.replace(/\D/g, '').slice(0, 10)
    } else if (name === 'password' || name === 'confirmPassword') {
      formattedValue = value.slice(0, 64)
    }

    const nextForm = { ...form, [name]: formattedValue }
    setForm(nextForm)

    if (touched[name]) {
      setErrors((previous) => ({
        ...previous,
        [name]: validate(name, formattedValue, nextForm),
      }))
    }

    if (name === 'password' && touched.confirmPassword) {
      setErrors((previous) => ({
        ...previous,
        confirmPassword: validate('confirmPassword', nextForm.confirmPassword, nextForm),
      }))
    }
  }

  const handleBlur = (event) => {
    const { name, value } = event.target
    setTouched((previous) => ({ ...previous, [name]: true }))
    setErrors((previous) => ({ ...previous, [name]: validate(name, value) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setApiError('')

    const requiredFields = ['nombre', 'email', 'telefono', 'password', 'confirmPassword']
    const newErrors = {}
    let hasError = false

    requiredFields.forEach((field) => {
      const error = validate(field, form[field], form)
      newErrors[field] = error
      if (error) hasError = true
    })

    setErrors(newErrors)
    setTouched(requiredFields.reduce((accumulator, field) => ({ ...accumulator, [field]: true }), {}))

    if (hasError) return

    setLoading(true)

    try {
      const data = await registrationService.register({
        nombre: form.nombre.trim(),
        correo: form.email.trim().toLowerCase(),
        telefono: form.telefono,
        contrasena: form.password,
      })

      const usuarioId = data?.usuarioId || data?.id || data?.data?.usuarioId || data?.data?.id
      if (!usuarioId) throw new Error('El servidor no devolvió el identificador del usuario')

      setUsuarioData(usuarioId, form.email)
      navigate('/registro/pago')
    } catch (err) {
      setApiError(err.message || 'No se pudo crear la cuenta. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const getInputClass = (name) => {
    const base = 'border rounded-lg px-4 py-2 text-sm focus:outline-none w-full transition-all duration-300 ease-in-out'
    if (errors[name] && touched[name]) {
      return `${base} border-red-400 focus:ring-2 focus:ring-red-400`
    }
    return `${base} border-slate-300 focus:ring-2 focus:ring-blue-500`
  }

  const passwordRules = getPasswordRules(form.password)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Datos del Titular</h2>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {apiError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm animate-fade-in">
              {apiError}
            </div>
          )}

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-slate-700 mb-1">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              id="nombre"
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Juan Pérez García"
              required
              maxLength={60}
              autoComplete="name"
              className={getInputClass('nombre')}
            />
            {errors.nombre && touched.nombre && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1 animate-fade-in">
                <AlertCircle className="w-3 h-3" />
                {errors.nombre}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="correo@ejemplo.com"
                required
                autoComplete="email"
                className={getInputClass('email')}
              />
              {errors.email && touched.email && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-slate-700 mb-1">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                id="telefono"
                type="tel"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="5512345678"
                required
                maxLength={10}
                inputMode="numeric"
                autoComplete="tel"
                className={getInputClass('telefono')}
              />
              {errors.telefono && touched.telefono && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3" />
                  {errors.telefono}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  maxLength={64}
                  autoComplete="new-password"
                  className={`${getInputClass('password')} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && touched.password && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">
                Confirmar contraseña <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Repite la contraseña"
                  required
                  maxLength={64}
                  autoComplete="new-password"
                  className={`${getInputClass('confirmPassword')} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && touched.confirmPassword && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1 animate-fade-in">
                  <AlertCircle className="w-3 h-3" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Requisitos de contraseña
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {passwordRules.map((rule) => {
                const RuleIcon = rule.valid ? CheckCircle2 : XCircle
                return (
                  <div
                    key={rule.label}
                    className={`flex items-center gap-2 text-xs ${
                      rule.valid ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    <RuleIcon className="w-4 h-4 shrink-0" />
                    {rule.label}
                  </div>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 font-medium transition-all duration-300 ease-in-out hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
          >
            {loading ? 'Creando cuenta...' : 'Continuar'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}
