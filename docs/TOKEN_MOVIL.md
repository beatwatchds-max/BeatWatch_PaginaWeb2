# Visualizacion segura del token movil

La pantalla Usuarios no depende de que GET /api/Usuarios exponga credenciales.

Al abrir el desplegable "Token de app movil", el frontend solicita bajo demanda:

POST /api/Usuarios/{id}/token-movil

El backend debe permitirlo solo al rol Administrador, validar la licencia y responder con Cache-Control: no-store.
El token permanece enmascarado hasta pulsar el icono del ojo y se elimina del estado temporal del frontend al cerrar el desplegable.
