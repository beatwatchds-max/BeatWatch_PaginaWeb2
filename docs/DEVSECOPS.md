# DevSecOps en BeatWatch

## Pipeline

`pull request / push -> install locked dependencies -> lint -> security policy tests -> build -> npm audit -> CodeQL -> Trivy`

DAST is intentionally manual because it targets a running environment and must only be executed against staging with authorization.

## Local commands

```bash
npm ci
npm run lint
npm run test:security
npm run build
npm run security:audit
```

## Required Render configuration

Set `VITE_API_URL` in Render before building the static site. Do not commit a production URL to source code.

`VITE_*` values are public browser configuration, not secrets.

## Payment backend contract

For the current free plan the frontend sends only:

```json
{
  "UsuarioId": "...",
  "TipoLicencia": "Grupal",
  "MetodoPago": "Gratuito",
  "CorreoElectronico": "..."
}
```

If the backend currently only accepts `card`, `paypal` or `oxxo`, add `Gratuito` (or configure `VITE_FREE_LICENSE_METHOD` to the backend's zero-cost enum). Do not restore raw card/CVV fields.

For future paid plans, create a provider-specific backend endpoint that accepts a payment token, not PAN/CVV.

## Recommended branch protection

Require the following checks before merging to `main`:

- CI / quality-and-security-gates
- CodeQL / JavaScript security analysis
- Trivy Security Scan / filesystem-scan

Also require pull-request review and block direct pushes to `main`.


## Controles de seguridad del frontend

- **RBAC de interfaz:** `/dashboard/usuarios` requiere rol `administrador`. Esto es defensa en profundidad; el backend debe aplicar la misma política y validar propiedad de recursos.
- **Data minimization y exposición controlada:** la vista de Usuarios conserva solo los campos necesarios. El `tokenMovil` se usa exclusivamente en la ruta administrativa, permanece dentro de un desplegable, está enmascarado por defecto y requiere una acción explícita con el icono de ojo para revelarse.
- **Tokens móviles:** no se renderizan ni se copian desde el dashboard.
- **JWT:** se rechazan tokens malformados, expirados, sin `exp` o con `nbf` futuro. El frontend no intenta verificar la firma; esa verificación pertenece al backend.
- **Errores:** las respuestas HTTP de error se transforman a mensajes públicos por código de estado y el payload interno no se adjunta al error mostrado.
- **Dispositivos:** UUID/números de serie se enmascaran en la interfaz.
- **CSP:** `connect-src` permite únicamente el propio origen y el backend conocido de BeatWatch.
- **Secret scanning:** las pruebas revisan también archivos `.env` y patrones comunes de credenciales. Las variables `VITE_*` deben contener exclusivamente configuración pública.

## Requisito de autorización en backend

Los IDs de usuario, paciente y dispositivo no son secretos y pueden viajar como identificadores técnicos. Sin embargo, cada endpoint debe validar el JWT, el rol y la relación del usuario autenticado con el recurso solicitado para impedir IDOR/BOLA. Ocultar un ID en la interfaz no sustituye esa autorización.
