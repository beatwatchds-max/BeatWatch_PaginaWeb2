import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  Flame,
  Footprints,
  HeartPulse,
  Moon,
  RefreshCw,
  Search,
  Timer,
} from 'lucide-react'
import analyticsService from '../../services/analyticsService'
import usersService from '../../services/usersService'
import useAuthStore, { normalizeRole } from '../../store/authStore'

const SERIES_METRICS = [
  { key: 'bpmPromedio', label: 'BPM promedio', unit: ' BPM', icon: HeartPulse },
  { key: 'pasos', label: 'Pasos', unit: '', icon: Footprints },
  { key: 'calorias', label: 'Calorías', unit: ' kcal', icon: Flame },
  { key: 'distanciaKm', label: 'Distancia', unit: ' km', icon: Activity },
  { key: 'horasSueno', label: 'Sueño', unit: ' h', icon: Moon },
]

const QUICK_PERIODS = [7, 14, 30, 90]

function valueFrom(source, keys, fallback = null) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key]
  }
  return fallback
}

function formatDate(value) {
  if (!value) return '—'

  const raw = String(value)
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw)

  if (Number.isNaN(parsed.getTime())) return raw

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
  }).format(parsed)
}

function formatNumber(value, maximumFractionDigits = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'

  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits,
  }).format(numeric)
}

function normalizeStatisticPatients(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.datos || payload?.data || payload?.pacientes || payload?.items || []

  if (!Array.isArray(list)) return []

  return list
    .map((item) => ({
      id: valueFrom(item, ['idPaciente', 'IdPaciente', 'id_paciente', 'pacienteId', 'PacienteId']),
      ultimoRegistro: valueFrom(item, ['ultimoRegistro', 'UltimoRegistro', 'fecha', 'Fecha']),
    }))
    .filter((patient) => patient.id)
}

function getPatientNameFromProfile(payload, fallback = 'Paciente') {
  return valueFrom(
    payload?.data || payload,
    ['nombreCompleto', 'NombreCompleto', 'nombre', 'Nombre', 'name'],
    fallback,
  )
}

function getSessionAuthorizedPatients(user) {
  if (!user || typeof user !== 'object') return []

  const directId =
    user.idPaciente || user.IdPaciente || user.id_paciente || user.pacienteId || user.PacienteId || ''

  const candidates = [
    ...(directId ? [directId] : []),
    ...(Array.isArray(user.pacientes) ? user.pacientes : []),
    ...(Array.isArray(user.pacientesAsignados) ? user.pacientesAsignados : []),
    ...(Array.isArray(user.patients) ? user.patients : []),
    ...(Array.isArray(user.patientIds) ? user.patientIds : []),
  ]

  return Array.from(
    new Map(
      candidates
        .map((candidate) => {
          if (candidate && typeof candidate === 'object') {
            const id = valueFrom(candidate, [
              'idPaciente',
              'IdPaciente',
              'id_paciente',
              'pacienteId',
              'PacienteId',
              'id',
              '_id',
            ])
            if (!id) return null
            return {
              id: String(id),
              name: valueFrom(candidate, ['nombre', 'nombreCompleto', 'name']) || 'Paciente',
            }
          }

          const id = String(candidate || '').trim()
          return id ? { id, name: 'Paciente' } : null
        })
        .filter(Boolean)
        .map((patient) => [patient.id, patient]),
    ).values(),
  )
}

function normalizeBpm(payload) {
  const points = payload?.puntos || payload?.Puntos || payload?.data?.puntos || []
  return Array.isArray(points) ? points : []
}

function normalizeEpisodes(payload) {
  const episodes = payload?.episodios || payload?.Episodios || payload?.data?.episodios || []
  return Array.isArray(episodes) ? episodes : []
}

function normalizeSeries(payload) {
  const source = payload?.series ?? payload?.Series ?? payload?.data?.series

  if (Array.isArray(source)) return source
  if (!source || typeof source !== 'object') return []

  const dateArray = source.fecha || source.fechas || source.Fecha || source.Fechas
  if (Array.isArray(dateArray)) {
    return dateArray.map((fecha, index) => {
      const row = { fecha }
      Object.entries(source).forEach(([key, values]) => {
        if (Array.isArray(values) && values !== dateArray) row[key] = values[index]
      })
      return row
    })
  }

  const rowsByDate = new Map()

  Object.entries(source).forEach(([metric, values]) => {
    if (!Array.isArray(values)) return

    values.forEach((item, index) => {
      if (item && typeof item === 'object') {
        const fecha = item.fecha || item.Fecha || String(index)
        const value = valueFrom(item, ['valor', 'value', metric], null)
        const current = rowsByDate.get(fecha) || { fecha }
        current[metric] = value
        rowsByDate.set(fecha, current)
      }
    })
  })

  return Array.from(rowsByDate.values())
}

function normalizeSummary(payload) {
  return payload?.resumen || payload?.Resumen || payload?.data || payload || null
}

function normalizeStatistics(payload) {
  const candidates = [
    payload,
    payload?.estadisticas,
    payload?.datos,
    payload?.data,
    payload?.items,
    payload?.registros,
  ]

  const list = candidates.find(Array.isArray)
  if (list) return list
  if (payload && typeof payload === 'object') return [payload]
  return []
}

function getSeriesValue(row, key) {
  const aliases = {
    bpmPromedio: ['bpmPromedio', 'BpmPromedio', 'promedioBPM', 'promedioBpm'],
    pasos: ['pasos', 'Pasos', 'totalPasos'],
    calorias: ['calorias', 'Calorias'],
    distanciaKm: ['distanciaKm', 'DistanciaKm', 'distancia'],
    horasSueno: ['horasSueno', 'HorasSueno', 'promedioHorasSueno'],
  }

  return valueFrom(row, aliases[key] || [key], null)
}

function LineChart({ data, lines, emptyMessage = 'No hay datos para el periodo seleccionado.' }) {
  const width = 820
  const height = 280
  const padding = { top: 22, right: 24, bottom: 52, left: 58 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const numericValues = data.flatMap((row) =>
    lines
      .map((line) => Number(line.getValue(row)))
      .filter((value) => Number.isFinite(value)),
  )

  if (!data.length || !numericValues.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    )
  }

  let min = Math.min(...numericValues)
  let max = Math.max(...numericValues)
  if (min === max) {
    min -= 1
    max += 1
  }

  const margin = (max - min) * 0.08
  min -= margin
  max += margin

  const xAt = (index) =>
    padding.left + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth)
  const yAt = (value) => padding.top + chartHeight - ((value - min) / (max - min)) * chartHeight

  const yTicks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4)
  const labelStep = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full h-auto" role="img">
        {yTicks.map((tick) => {
          const y = yAt(tick)
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-slate-200"
                strokeDasharray="4 5"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[11px]"
              >
                {formatNumber(tick, 0)}
              </text>
            </g>
          )
        })}

        {data.map((row, index) => {
          if (index % labelStep !== 0 && index !== data.length - 1) return null
          return (
            <text
              key={`${row.fecha}-${index}`}
              x={xAt(index)}
              y={height - 18}
              textAnchor="middle"
              className="fill-slate-400 text-[11px]"
            >
              {formatDate(row.fecha)}
            </text>
          )
        })}

        {lines.map((line) => {
          const points = data
            .map((row, index) => {
              const value = Number(line.getValue(row))
              if (!Number.isFinite(value)) return null
              return `${xAt(index)},${yAt(value)}`
            })
            .filter(Boolean)
            .join(' ')

          return (
            <polyline
              key={line.label}
              fill="none"
              stroke={line.stroke}
              strokeWidth={line.width || 3}
              strokeDasharray={line.dash || undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          )
        })}

        {data.map((row, index) => {
          const primaryValue = Number(lines[0].getValue(row))
          if (!Number.isFinite(primaryValue)) return null

          return (
            <circle
              key={`point-${row.fecha}-${index}`}
              cx={xAt(index)}
              cy={yAt(primaryValue)}
              r="3.5"
              fill={lines[0].stroke}
              stroke="white"
              strokeWidth="2"
            >
              <title>{`${formatDate(row.fecha)}: ${formatNumber(primaryValue)}${lines[0].unit || ''}`}</title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}

function BarChart({ data }) {
  const width = 820
  const height = 280
  const padding = { top: 22, right: 24, bottom: 52, left: 58 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const values = data.flatMap((row) => [Number(row.totalArritmias), Number(row.criticas)])
  const max = Math.max(1, ...values.filter(Number.isFinite))

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400">
        No hay episodios para el periodo seleccionado.
      </div>
    )
  }

  const groupWidth = chartWidth / data.length
  const barWidth = Math.min(26, groupWidth * 0.28)
  const labelStep = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full h-auto" role="img">
        {Array.from({ length: 5 }, (_, index) => {
          const value = (max * index) / 4
          const y = padding.top + chartHeight - (value / max) * chartHeight
          return (
            <g key={index}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-slate-200"
                strokeDasharray="4 5"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[11px]"
              >
                {formatNumber(value, 0)}
              </text>
            </g>
          )
        })}

        {data.map((row, index) => {
          const center = padding.left + groupWidth * index + groupWidth / 2
          const total = Number(row.totalArritmias) || 0
          const critical = Number(row.criticas) || 0
          const totalHeight = (total / max) * chartHeight
          const criticalHeight = (critical / max) * chartHeight

          return (
            <g key={`${row.fecha}-${index}`}>
              <rect
                x={center - barWidth - 2}
                y={padding.top + chartHeight - totalHeight}
                width={barWidth}
                height={totalHeight}
                rx="4"
                className="fill-blue-500"
              >
                <title>{`Arritmias: ${total}`}</title>
              </rect>
              <rect
                x={center + 2}
                y={padding.top + chartHeight - criticalHeight}
                width={barWidth}
                height={criticalHeight}
                rx="4"
                className="fill-rose-500"
              >
                <title>{`Críticas: ${critical}`}</title>
              </rect>
              {(index % labelStep === 0 || index === data.length - 1) && (
                <text
                  x={center}
                  y={height - 18}
                  textAnchor="middle"
                  className="fill-slate-400 text-[11px]"
                >
                  {formatDate(row.fecha)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, helper, accent = 'blue' }) {
  const styles = {
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
          {helper && <p className="text-xs text-slate-400 mt-1">{helper}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles[accent]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function SectionError({ message }) {
  if (!message) return null

  return (
    <div className="m-5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

const STAT_COLUMN_LABELS = {
  fecha: 'Fecha',
  bpmpromedio: 'BPM promedio',
  bpmminimo: 'BPM mínimo',
  bpmmaximo: 'BPM máximo',
  pasos: 'Pasos',
  totalpasos: 'Pasos',
  calorias: 'Calorías',
  distanciakm: 'Distancia (km)',
  distanciatotalkm: 'Distancia (km)',
  distancia: 'Distancia (km)',
  horassueno: 'Horas de sueño',
  promediohorassueno: 'Horas de sueño',
  totalarritmias: 'Arritmias totales',
  alertascriticas: 'Alertas críticas',
  episodioscriticos: 'Episodios críticos',
}

const STAT_PREFERRED_COLUMNS = [
  'fecha',
  'bpmpromedio',
  'bpmminimo',
  'bpmmaximo',
  'horassueno',
  'pasos',
  'totalpasos',
  'calorias',
  'distanciakm',
  'distanciatotalkm',
  'totalarritmias',
  'alertascriticas',
  'episodioscriticos',
]

function normalizeColumnName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function isIdentifierColumn(column) {
  const normalized = normalizeColumnName(column)

  if (!normalized) return true

  return (
    normalized === 'id' ||
    normalized.startsWith('id') ||
    normalized.endsWith('id') ||
    normalized.includes('objectid') ||
    normalized.includes('documentid') ||
    normalized.includes('sourceid')
  )
}

function getStatisticLabel(column) {
  const normalized = normalizeColumnName(column)
  return STAT_COLUMN_LABELS[normalized] || String(column).replace(/[_-]+/g, ' ')
}

function formatStatisticValue(column, value) {
  if (value === undefined || value === null || value === '') return '—'

  const normalized = normalizeColumnName(column)
  if (normalized.includes('fecha')) return formatDate(value)

  if (typeof value === 'number') return formatNumber(value)

  if (typeof value === 'object') {
    // No exponer objetos internos de Mongo/API en la tabla de presentación.
    return '—'
  }

  return String(value)
}

function StatisticsTable({ rows }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-400 py-8 text-center">No hay estadísticas disponibles.</p>
  }

  const allKeys = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row || {}))),
  ).filter((column) => !isIdentifierColumn(column))

  const keyByNormalizedName = new Map(
    allKeys.map((column) => [normalizeColumnName(column), column]),
  )

  const preferredColumns = STAT_PREFERRED_COLUMNS
    .map((normalized) => keyByNormalizedName.get(normalized))
    .filter(Boolean)

  const columns = [
    ...preferredColumns,
    ...allKeys.filter((column) => !preferredColumns.includes(column)),
  ].slice(0, 8)

  if (!columns.length) {
    return <p className="text-sm text-slate-400 py-8 text-center">La API no devolvió campos clínicos para mostrar.</p>
  }

  return (
    <>
      {/* Vista compacta para móvil: evita una tabla horizontal enorme. */}
      <div className="grid gap-3 p-4 md:hidden">
        {rows.slice(0, 8).map((row, index) => (
          <article key={index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {columns.map((column) => (
                <div key={column} className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">
                    {getStatisticLabel(column)}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-700 break-words">
                    {formatStatisticValue(column, row?.[column])}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      {/* Escritorio: sólo datos útiles; IDs internos quedan ocultos. */}
      <div className="hidden md:block w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-y border-slate-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500 whitespace-nowrap"
                >
                  {getStatisticLabel(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 8).map((row, index) => (
              <tr key={index} className="hover:bg-slate-50/80">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                    {formatStatisticValue(column, row?.[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function AnalyticsView() {
  const authUser = useAuthStore((state) => state.user)
  const authRole = useAuthStore((state) => state.role)
  const [patientId, setPatientId] = useState(
    authUser?.idPaciente || authUser?.IdPaciente || authUser?.id_paciente || authUser?.pacienteId || '',
  )
  const [patients, setPatients] = useState([])
  const [days, setDays] = useState(7)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [selectedMetrics, setSelectedMetrics] = useState(
    SERIES_METRICS.map((metric) => metric.key),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sectionErrors, setSectionErrors] = useState({})
  const [dashboard, setDashboard] = useState({
    resumen: null,
    bpm: [],
    episodios: [],
    series: [],
    estadisticas: [],
  })

  useEffect(() => {
    let active = true

    const loadPatients = async () => {
      const normalizedRole = normalizeRole(authRole)

      // Secure-by-default: only administrators can discover the global patient catalog.
      // Other roles can use only patient IDs already authorized and delivered in their session.
      if (normalizedRole !== 'administrador') {
        const authorizedPatients = getSessionAuthorizedPatients(authUser)
        if (!active) return

        setPatients(authorizedPatients)
        setPatientId((current) => {
          if (authorizedPatients.some((patient) => patient.id === current)) return current
          return authorizedPatients.length === 1 ? authorizedPatients[0].id : ''
        })
        return
      }

      try {
        // Administrator-only discovery of patients with statistics.
        const payload = await analyticsService.getPacientesEstadisticas()
        const statisticPatients = normalizeStatisticPatients(payload)

        const resolved = await Promise.all(
          statisticPatients.map(async (patient) => {
            const patientId = String(patient.id)

            try {
              // Solo se consulta el perfil para obtener un nombre legible.
              // El ID nunca se muestra en el selector.
              const profile = await usersService.getPatientProfileByPatientId(patientId)
              return {
                id: patientId,
                name: getPatientNameFromProfile(profile, 'Paciente'),
                ultimoRegistro: patient.ultimoRegistro,
              }
            } catch {
              // Si el perfil no tiene nombre disponible, mantenemos el paciente
              // sin exponer el ObjectId en la interfaz.
              return {
                id: patientId,
                name: 'Paciente',
                ultimoRegistro: patient.ultimoRegistro,
              }
            }
          }),
        )

        if (!active) return

        const uniquePatients = Array.from(
          new Map(
            resolved
              .filter(Boolean)
              .map((patient) => [patient.id, patient]),
          ).values(),
        )

        setPatients(uniquePatients)

        if (uniquePatients.length === 1) {
          setPatientId((current) => current || uniquePatients[0].id)
        } else {
          setPatientId((current) =>
            uniquePatients.some((patient) => patient.id === current) ? current : '',
          )
        }
      } catch {
        if (active) setPatients([])
      }
    }

    loadPatients()

    return () => {
      active = false
    }
  }, [authRole, authUser])

  const loadDashboard = useCallback(async () => {
    const normalizedPatientId = String(patientId || '').trim()
    if (!normalizedPatientId) {
      setError('Selecciona un paciente para consultar sus datos.')
      return
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError('La fecha de inicio no puede ser posterior a la fecha final.')
      return
    }

    setLoading(true)
    setError('')
    setSectionErrors({})

    const baseFilters = {
      fechaInicio,
      fechaFin,
      dias: fechaInicio || fechaFin ? undefined : days,
    }

    const metricFilter =
      selectedMetrics.length === SERIES_METRICS.length ? undefined : selectedMetrics

    const requests = [
      analyticsService.getResumen(normalizedPatientId, baseFilters),
      analyticsService.getBpm(normalizedPatientId, baseFilters),
      analyticsService.getEpisodios(normalizedPatientId, baseFilters),
      analyticsService.getSeries(normalizedPatientId, {
        ...baseFilters,
        metricas: metricFilter,
      }),
      analyticsService.getEstadisticas(normalizedPatientId, baseFilters),
    ]

    try {
      const [resumenResult, bpmResult, episodesResult, seriesResult, statsResult] =
        await Promise.allSettled(requests)

      const nextErrors = {}

      const resultValue = (result, key, fallback) => {
        if (result.status === 'fulfilled') return result.value
        nextErrors[key] = result.reason?.message || 'No fue posible cargar esta sección.'
        return fallback
      }

      const resumenPayload = resultValue(resumenResult, 'resumen', null)
      const bpmPayload = resultValue(bpmResult, 'bpm', null)
      const episodesPayload = resultValue(episodesResult, 'episodios', null)
      const seriesPayload = resultValue(seriesResult, 'series', null)
      const statsPayload = resultValue(statsResult, 'estadisticas', null)

      setDashboard({
        resumen: normalizeSummary(resumenPayload),
        bpm: normalizeBpm(bpmPayload),
        episodios: normalizeEpisodes(episodesPayload),
        series: normalizeSeries(seriesPayload),
        estadisticas: normalizeStatistics(statsPayload),
      })
      setSectionErrors(nextErrors)

      if (Object.keys(nextErrors).length === requests.length) {
        setError('No fue posible consultar los datos del paciente. Verifica los permisos y la conexión con la API.')
      }
    } finally {
      setLoading(false)
    }
  }, [days, fechaFin, fechaInicio, patientId, selectedMetrics])

  const resumen = dashboard.resumen || {}
  const totalDuration = useMemo(
    () => dashboard.episodios.reduce((total, item) => total + (Number(item.duracionTotalSegundos) || 0), 0),
    [dashboard.episodios],
  )
  const totalCritical = useMemo(
    () => dashboard.episodios.reduce((total, item) => total + (Number(item.criticas) || 0), 0),
    [dashboard.episodios],
  )

  const bpmLines = [
    { label: 'Promedio', stroke: '#2563eb', unit: ' BPM', getValue: (row) => row.promedio },
    { label: 'Máximo', stroke: '#f43f5e', dash: '7 5', width: 2, getValue: (row) => row.maximo },
    { label: 'Mínimo', stroke: '#10b981', dash: '7 5', width: 2, getValue: (row) => row.minimo },
  ]

  const toggleMetric = (key) => {
    setSelectedMetrics((current) =>
      current.includes(key) ? current.filter((metric) => metric !== key) : [...current, key],
    )
  }

  return (
    <div className="w-full max-w-[1680px] mx-auto min-w-0 p-4 md:p-6 xl:p-8 space-y-6">
      <section className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end gap-5 justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-xs uppercase tracking-[0.18em] font-semibold">
              <BarChart3 className="w-4 h-4" />
              Monitoreo clínico
            </div>
            <h2 className="text-2xl font-bold mt-2">Dashboard de gráficas</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Consulta BPM, arritmias, actividad, sueño y estadísticas históricas por paciente.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDashboard}
            disabled={loading || !patientId}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Actualizando...' : 'Consultar datos'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label htmlFor="patientId" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Paciente
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <select
                id="patientId"
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                className="w-full border border-slate-300 bg-white rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un paciente</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Selecciona al paciente por su nombre. El identificador se utiliza únicamente de forma interna para consultar la API.
            </p>
          </div>

          <div>
            <label htmlFor="fechaInicio" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Fecha inicio
            </label>
            <input
              id="fechaInicio"
              type="date"
              value={fechaInicio}
              onChange={(event) => setFechaInicio(event.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="fechaFin" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Fecha fin
            </label>
            <input
              id="fechaFin"
              type="date"
              value={fechaFin}
              onChange={(event) => setFechaFin(event.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="days" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Días
            </label>
            <select
              id="days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="w-full border border-slate-300 bg-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {QUICK_PERIODS.map((period) => (
                <option key={period} value={period}>Últimos {period} días</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-slate-400 py-1.5 mr-1">Series a mostrar:</span>
          {SERIES_METRICS.map((metric) => {
            const active = selectedMetrics.includes(metric.key)
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => toggleMetric(metric.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {metric.label}
              </button>
            )
          })}
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={HeartPulse}
          label="Promedio BPM"
          value={`${formatNumber(valueFrom(resumen, ['promedioBPM', 'PromedioBPM']))} BPM`}
          helper={valueFrom(resumen, ['periodo', 'Periodo'], `Últimos ${days} días`)}
          accent="blue"
        />
        <StatCard
          icon={Footprints}
          label="Total pasos"
          value={formatNumber(valueFrom(resumen, ['totalPasos', 'TotalPasos']), 0)}
          helper="Actividad acumulada"
          accent="emerald"
        />
        <StatCard
          icon={Activity}
          label="Total arritmias"
          value={formatNumber(valueFrom(resumen, ['totalArritmias', 'TotalArritmias']), 0)}
          helper={`${formatNumber(totalCritical, 0)} episodios críticos`}
          accent="rose"
        />
        <StatCard
          icon={Moon}
          label="Promedio sueño"
          value={`${formatNumber(valueFrom(resumen, ['promedioHorasSueno', 'PromedioHorasSueno']))} h`}
          helper="Horas por noche"
          accent="violet"
        />
      </section>

      <SectionError message={sectionErrors.resumen} />

      <section className="grid min-w-0 grid-cols-1 xl:grid-cols-2 gap-5 xl:gap-6">
        <div className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-blue-600" />
                Tendencia de BPM
              </h3>
              <p className="text-xs text-slate-400 mt-1">Promedio, mínimo y máximo por fecha.</p>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-blue-600">● Promedio</span>
              <span className="text-rose-500">● Máximo</span>
              <span className="text-emerald-500">● Mínimo</span>
            </div>
          </div>
          <SectionError message={sectionErrors.bpm} />
          <div className="p-4">
            <LineChart data={dashboard.bpm} lines={bpmLines} />
          </div>
        </div>

        <div className="min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-600" />
                Episodios de arritmia
              </h3>
              <p className="text-xs text-slate-400 mt-1">Comparación de episodios totales y críticos.</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="text-blue-600">● Totales</span>
              <span className="text-rose-500">● Críticas</span>
              <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> {formatNumber(totalDuration / 60)} min</span>
            </div>
          </div>
          <SectionError message={sectionErrors.episodios} />
          <div className="p-4">
            <BarChart data={dashboard.episodios} />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-violet-600" />
              Series de salud y actividad
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Cada métrica usa su propia escala para evitar mezclar unidades incompatibles.
            </p>
          </div>
        </div>
        <SectionError message={sectionErrors.series} />

        <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
          {SERIES_METRICS.filter((metric) => selectedMetrics.includes(metric.key)).map((metric) => {
            const Icon = metric.icon
            const hasData = dashboard.series.some((row) => Number.isFinite(Number(getSeriesValue(row, metric.key))))

            return (
              <div key={metric.key} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-blue-600" />
                    {metric.label}
                  </h4>
                  {hasData && (
                    <span className="text-xs text-slate-400">
                      {dashboard.series.length} puntos
                    </span>
                  )}
                </div>
                <LineChart
                  data={dashboard.series}
                  lines={[
                    {
                      label: metric.label,
                      stroke: '#4f46e5',
                      unit: metric.unit,
                      getValue: (row) => getSeriesValue(row, metric.key),
                    },
                  ]}
                  emptyMessage={`Sin datos para ${metric.label.toLowerCase()}.`}
                />
              </div>
            )
          })}

          {selectedMetrics.length === 0 && (
            <div className="xl:col-span-2 py-10 text-center text-sm text-slate-400">
              Selecciona al menos una métrica para mostrar sus series.
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Estadísticas del paciente</h3>
          <p className="text-xs text-slate-400 mt-1">
            Historial de estadísticas registradas para el paciente seleccionado.
          </p>
        </div>
        <SectionError message={sectionErrors.estadisticas} />
        <StatisticsTable rows={dashboard.estadisticas} />
      </section>
    </div>
  )
}
