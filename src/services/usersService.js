import apiClient from '../api/client'

const ENDPOINTS = Object.freeze({
  list: '/api/Usuarios',

  registerPatient:
    '/api/Pacientes/registrar',

  registerCuidador:
    '/api/Usuarios/registrar-cuidador',

  cuidadoresDisponibles:
    '/api/Usuarios/cuidadores-disponibles',

  patientProfileByUserId: (userId) =>
    `/api/Pacientes/usuario/${encodeURIComponent(userId)}`,

  patientProfileByPatientId: (patientId) =>
    `/api/Pacientes/perfil/paciente/${encodeURIComponent(patientId)}`,

  remove: (id) =>
    `/api/Usuarios/${encodeURIComponent(id)}`,
})

const usersService = {
  list() {
    return apiClient.get(ENDPOINTS.list)
  },

  registerPatient(payload) {
    return apiClient.post(
      ENDPOINTS.registerPatient,
      payload
    )
  },

  registerCuidador(payload) {
    return apiClient.post(
      ENDPOINTS.registerCuidador,
      payload
    )
  },

  getCuidadoresDisponibles() {
    return apiClient.get(
      ENDPOINTS.cuidadoresDisponibles
    )
  },

  getPatientProfileByUserId(userId) {
    if (!userId) {
      throw new Error('El ID del usuario es obligatorio')
    }

    return apiClient.get(
      ENDPOINTS.patientProfileByUserId(userId)
    )
  },

  getPatientProfileByPatientId(patientId) {
    if (!patientId) {
      throw new Error('El ID del paciente es obligatorio')
    }

    return apiClient.get(
      ENDPOINTS.patientProfileByPatientId(patientId)
    )
  },

  remove(id) {
    if (!id) {
      throw new Error(
        'El ID del usuario es obligatorio'
      )
    }

    return apiClient.delete(
      ENDPOINTS.remove(id)
    )
  },
}

export default usersService