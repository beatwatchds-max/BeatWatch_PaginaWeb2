# BeatWatch Security Policy

## Security gates

Every pull request and push to `main` must pass:

1. `npm ci` using the committed lockfile.
2. Oxlint.
3. Repository security policy tests (`npm run test:security`).
4. Production build.
5. `npm audit` for HIGH/CRITICAL runtime dependency findings.
6. CodeQL JavaScript security analysis.
7. Trivy filesystem scan for vulnerabilities, secrets and misconfiguration.

A manual ZAP baseline workflow is available only for an authorized staging environment.

## Secrets

- Never commit `.env` files.
- Never put secrets in `VITE_*` variables. Vite exposes them to the browser bundle.
- Store backend/provider secrets in Render/GitHub secret stores.
- Rotate any credential that is accidentally committed; deleting it from the latest commit is not enough.

## Authentication

The current backend contract returns a Bearer token. The frontend stores exactly one session copy under `beatwatch-auth` in `sessionStorage` and sends it through the centralized HTTP client.

For a stronger production posture, migrate the backend to a `Secure; HttpOnly; SameSite` cookie so JavaScript cannot read the session credential.

## Payments

The zero-cost license flow does not collect card PAN, expiration date or CVV.

For any paid plan, use hosted fields or Elements/Bricks from a PCI-compliant payment provider. The browser should send only a provider token/payment-method identifier to BeatWatch. CVV must never be stored or logged by BeatWatch.

## DAST authorization

Run `DAST - ZAP Baseline` only against systems you own or are explicitly authorized to test. Use staging instead of production.


## Frontend authorization and sensitive-data display

- The `/dashboard/usuarios` route is restricted in the UI to the `administrador` role.
- Role checks in the frontend are defense-in-depth only. The backend remains responsible for validating authorization and resource ownership on every request.
- Mobile access tokens are intentionally discarded from user-list state and are never rendered or copied from the dashboard.
- Device hardware identifiers are masked before display.
- Backend error payloads are not surfaced directly to users.
- JWT payload decoding is used only for client-side session UX; signature and authorization validation must be performed by the backend.
