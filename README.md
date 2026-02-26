# 🔐 Hardened JWT Authentication System

A production-grade authentication and authorization backend built with **defense-in-depth security principles**. Combines modern authentication mechanisms with multi-layered middleware protections.

## 🛡️ Security Architecture

```
Client → Nginx (SSL + Headers + Rate Limit) → Express (Sanitize + Validate) → API → Redis → MongoDB
```

Each layer enforces independent security controls.

---

## ✅ Features

### Authentication
- JWT access tokens with `aud` + `iss` claim validation
- Refresh tokens with **mandatory rotation** + **family-based revocation**
- bcrypt password hashing (auto-salted, 12 rounds)
- Two-Factor Authentication (TOTP / Authenticator)
- Google OAuth 2.0 with PKCE
- Device fingerprint binding (User-Agent + IP subnet + Device ID)
- Account lockout after repeated failures

### Authorization
- Role-Based Access Control (RBAC) — `user` / `admin` roles
- Protected and admin-only routes
- Response field filtering by role

### Token Security
- Redis-backed token blacklisting (O(1) lookups)
- Per-token and per-user mass revocation
- Refresh token reuse detection → entire family revoked
- Self-cleaning TTL (expired tokens auto-removed)

### Middleware Stack (11 layers)
1. Helmet (CSP, HSTS, X-Frame-Options, etc.)
2. Permissions-Policy (restrict browser APIs)
3. CORS (credentials mode)
4. Body size limits (10kb)
5. Cookie parser (signed cookies)
6. HPP (HTTP Parameter Pollution protection)
7. NoSQL injection sanitization
8. Structured request logging (X-Request-ID)
9. Rate limiting (general + auth + 2FA tiers)
10. CSRF protection (double-submit cookie)
11. Passport (Google OAuth)

### Monitoring & Anomaly Detection
- JSON-structured logs (Pino) — SIEM-compatible
- Every log: `timestamp`, `userId`, `ip`, `requestId`, `action`, `outcome`
- Credential stuffing detection (5+ failures from 3+ IPs in 60s)
- Security event alerting

---

## 🏗️ Project Structure

```
├── config/
│   ├── db.js              # MongoDB connection
│   ├── redis.js           # Redis client
│   ├── logger.js          # Pino structured logger
│   └── passport.js        # Google OAuth strategy
├── models/
│   ├── User.js            # User with bcrypt + lockout
│   ├── RefreshToken.js    # Family tracking + hashed storage
│   └── LoginAttempt.js    # Anomaly detection data
├── utils/
│   ├── jwt.js             # Token generation/verification
│   ├── deviceFingerprint.js
│   ├── tokenBlacklist.js  # Redis blacklist
│   └── anomalyDetector.js # Credential stuffing detection
├── middleware/
│   ├── auth.js            # JWT verification + blacklist check
│   ├── rbac.js            # Role-based access
│   ├── rateLimiter.js     # 3-tier rate limiting
│   ├── validate.js        # Joi allowlist validation
│   ├── sanitize.js        # NoSQL injection defense
│   ├── requestLogger.js   # Structured logging
│   └── csrfProtection.js  # Double-submit cookie
├── validators/
│   └── authSchemas.js     # Joi schemas
├── controllers/
│   ├── authController.js  # Register, login, logout, refresh, 2FA
│   ├── oauthController.js # Google OAuth + PKCE
│   ├── profileController.js
│   └── adminController.js # User mgmt + force logout
├── routes/
│   ├── authRoutes.js
│   ├── oauthRoutes.js
│   ├── profileRoutes.js
│   └── adminRoutes.js
├── scripts/
│   ├── massRevoke.js      # CLI token revocation
│   └── secretRotation.md  # Operational runbook
├── nginx/
│   └── nginx.conf         # Reverse proxy config
├── .github/workflows/
│   └── security.yml       # CI scanning pipeline
├── server.js              # Entry point
├── Dockerfile             # Hardened multi-stage build
└── docker-compose.yml     # Network-segmented deployment
```

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Register new user |
| `POST` | `/api/auth/login` | ❌ | Login (supports 2FA) |
| `POST` | `/api/auth/logout` | ✅ | Logout + token invalidation |
| `POST` | `/api/auth/refresh` | ❌ | Rotate refresh token |
| `POST` | `/api/auth/2fa/setup` | ✅ | Generate 2FA QR code |
| `POST` | `/api/auth/2fa/verify` | ✅ | Enable 2FA |
| `GET` | `/api/auth/csrf-token` | ❌ | Get CSRF token |
| `GET` | `/api/oauth/google` | ❌ | Initiate Google OAuth |
| `GET` | `/api/profile` | ✅ | Get user profile |
| `GET` | `/api/admin/users` | 🛡️ Admin | List all users |
| `POST` | `/api/admin/force-logout/:userId` | 🛡️ Admin | Force logout user |
| `GET` | `/api/health` | ❌ | Health check |

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js / Express |
| Database | MongoDB (Mongoose) |
| Cache / Blacklist | Redis (ioredis) |
| Auth | JWT + bcrypt + speakeasy |
| OAuth | Passport + Google OAuth 2.0 |
| Validation | Joi (allowlist mode) |
| Security Headers | Helmet |
| Logging | Pino (JSON structured) |
| Reverse Proxy | Nginx |
| Deployment | Docker (multi-stage, non-root) |
| CI Scanning | Trivy, gitleaks, npm audit |

---

## 🚀 Quick Start

### Local Development
```bash
# Clone & install
git clone <repository-url>
cd hardened-jwt-auth
npm install

# Copy environment variables
cp .env.example .env

# Start MongoDB & Redis (Docker)
docker run -d --name mongodb -p 27017:27017 mongo:7
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Start dev server
npm run dev
```

### Docker Deployment
```bash
docker compose up -d
```

---

## 🔐 Environment Variables

See [.env.example](.env.example) for all required variables.

> ⚠️ Never commit `.env` files. Use Docker Secrets or a secrets manager in production.

---

## 🛡️ Threat Mitigations

| Threat | Defense |
|--------|---------|
| Brute Force | Rate limiting + account lockout |
| Credential Stuffing | Anomaly detection (multi-IP pattern) |
| Token Theft | Device fingerprint binding + family revocation |
| Session Hijacking | Short-lived tokens + mandatory rotation |
| SQL/NoSQL Injection | Parameterized queries + Mongoose strict schemas + sanitization |
| XSS | CSP headers + HttpOnly cookies |
| CSRF | Double-submit cookie pattern |
| Replay Attacks | Token blacklisting + jti tracking |
| Supply Chain | Pinned images + CI scanning |
| Privilege Escalation | RBAC + response filtering |
