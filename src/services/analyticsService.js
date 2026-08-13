import apiClient from '../api/client'

function encodePatientId(patientId) {
  const normalized = String(patientId || '').trim()

  if (!normalized) {
    throw new Error('El ID del paciente es obligatorio')
  }

  return encodeURIComponent(normalized)
}

function toApiDate(value, isEnd = false) {
  if (!value) return undefined
  if (value.includes('T')) return value
  return `${value}T${isEnd ? '23:59:59' : '00:00:00'}`
}

function buildQuery(params = {}) {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return

    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','))
      return
    }

    search.set(key, String(value))
  })

  const query = search.toString()
  return query ? `?${query}` : ''
}

function commonDateParams(filters = {}) {
  return {
    fecha_inicio: toApiDate(filters.fechaInicio),
    fecha_fin: toApiDate(filters.fechaFin, true),
  }
}

const analyticsService = {
  getPacientesEstadisticas() {
    return apiClient.get('/api/pacientes')
  },

  getEstadisticas(patientId, filters = {}) {
    const id = encodePatientId(patientId)
    const query = buildQuery(commonDateParams(filters))
    return apiClient.get(`/api/estadisticas/${id}${query}`)
  },

  getBpm(patientId, filters = {}) {
    const id = encodePatientId(patientId)
    const query = buildQuery({
      ...commonDateParams(filters),
      dias: filters.dias,
    })
    return apiClient.get(`/api/graficas/${id}/bpm${query}`)
  },

  getEpisodios(patientId, filters = {}) {
    const id = encodePatientId(patientId)
    const query = buildQuery({
      ...commonDateParams(filters),
      dias: filters.dias,
    })
    return apiClient.get(`/api/graficas/${id}/episodios${query}`)
  },

  getSeries(patientId, filters = {}) {
    const id = encodePatientId(patientId)
    const query = buildQuery({
      ...commonDateParams(filters),
      metricas: filters.metricas,
    })
    return apiClient.get(`/api/graficas/${id}/series${query}`)
  },

  getResumen(patientId, filters = {}) {
    const id = encodePatientId(patientId)
    const query = buildQuery({
      ...commonDateParams(filters),
      dias: filters.dias,
    })
    return apiClient.get(`/api/graficas/${id}/resumen${query}`)
  },
}

export default analyticsService
