# AASHVO — MASTER RELEASE ENVIRONMENT INVENTORY
## Multi-Tier Environment Specifications, Ports, Configurations & Variable Reference

**Author:** DevOps Lead & Principal Architect  
**Project:** AASHVO Platform  
**Target Release Candidate:** `rc-1.0.0-independent`  
**Date:** November 14, 2026  

---

## 1. ENVIRONMENT TOPOLOGY MATRIX

| Specification | Local Development (`local`) | Staging / Pre-Prod (`staging`) | Production (`prod`) |
| :--- | :--- | :--- | :--- |
| **Frontend Host** | `http://localhost:5173` | `https://staging.aashvo.com` | `https://aashvo.vercel.app` / `https://aashvo.com` |
| **Backend API Host** | `http://localhost:4000` | `https://api-staging.aashvo.com` | `https://api.aashvo.com` |
| **API Path Prefix** | `/api/v1` | `/api/v1` | `/api/v1` |
| **Database Host** | `127.0.0.1:5433` (PostgreSQL 16) | DigitalOcean Managed PG 16 | DigitalOcean Managed PG 16 (BLR1) |
| **Database Name** | `aashvo_test` | `aashvo_staging` | `aashvo_prod` |
| **Public Asset Bucket** | Local Simulated / R2 Staging | Cloudflare R2 (`aashvo-public-staging`) | Cloudflare R2 (`aashvo-public-assets-prod`) |
| **Private Document Bucket** | Local Simulated / S3 Staging | AWS S3 `ap-south-1` (`aashvo-private-staging`) | AWS S3 `ap-south-1` (`aashvo-private-docs-prod`) |
| **Node.js Runtime** | Node.js v20.x / v22.x LTS | Node.js v20.x LTS | Node.js v20.x LTS |
| **Package Manager** | npm v10+ (Workspaces) | npm v10+ (Workspaces) | npm v10+ (Workspaces) |
| **Cookie Name** | `aashvo_rt` (`secure: false`) | `__Host-aashvo_rt` (`secure: true`) | `__Host-aashvo_rt` (`secure: true`) |
| **Throttling** | 100 req/min (Skip in tests) | 60 req/min | 60 req/min (Login: 5 req/15min) |

---

## 2. MONOREPO WORKSPACE TOPOLOGY

```
D:\Projects\AASHVO\
├── package.json                        (Monorepo root orchestrator)
├── vite.config.ts                      (Frontend Vite builder & dev reverse proxy)
├── src\                                (React 18 + Vite + Tailwind client)
│   ├── components\                     (UI components: discovery, auth, rental, admin, help)
│   ├── services\                       (apiClient, authService, marketplaceService, storageService)
│   └── test\                           (21 Vitest test suites, 232 automated tests)
├── packages\
│   └── contracts\                      (Shared TypeScript DTOs, Enums, Error Codes)
│       ├── package.json                (@aashvo/contracts)
│       └── src\                        (domain.ts, enums.ts, errors.ts, health.ts)
└── apps\
    └── api\                            (Independent NestJS 11 + Prisma monolith)
        ├── package.json                (@aashvo/api)
        ├── prisma\
        │   ├── schema.prisma           (23 models, PostgreSQL 16 schema)
        │   └── migrations\             (Versioned database migrations)
        ├── src\
        │   ├── modules\                (auth, users, profiles, properties, flatmates, family-stays,
        │   │                            inquiries, agreements, inspections, reviews, disputes, support)
        │   └── infrastructure\         (prisma, config, observability, health)
        └── test\                       (8 Jest suites, 53 integration tests on PG 16)
```

---

## 3. MASTER ENVIRONMENT VARIABLE REGISTER

### Backend API Variables (`apps/api/.env`)

```ini
# Application Core
NODE_ENV=production
PORT=4000
TRUST_PROXY=true

# Database Connection (SCRAM-SHA-256 with SSL)
DATABASE_URL=postgresql://user:password@pg-host:25060/aashvo_prod?sslmode=require
DIRECT_URL=postgresql://user:password@pg-host:5432/aashvo_prod?sslmode=require

# Authentication & Asymmetric RS256 Cryptography
JWT_SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
JWT_SIGNING_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
JWT_ACCESS_EXPIRATION_SECONDS=900
JWT_REFRESH_EXPIRATION_SECONDS=2592000
COOKIE_SECURE=true
COOKIE_SECRET=replace_with_64_byte_random_hex_value

# Cross-Origin Resource Sharing
CORS_ALLOWED_ORIGINS=https://aashvo.vercel.app,https://aashvo.com

# Rate Limiting & DoS Shield
THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=60

# Cloudflare R2 Public Media
CLOUDFLARE_R2_ACCOUNT_ID=replace_with_r2_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=replace_with_r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=replace_with_r2_secret
CLOUDFLARE_R2_BUCKET=aashvo-public-assets-prod
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://media.aashvo.com

# AWS S3 ap-south-1 Mumbai Private Documents
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=replace_with_aws_access_key
AWS_SECRET_ACCESS_KEY=replace_with_aws_secret
AWS_S3_PRIVATE_BUCKET=aashvo-private-docs-prod

# Transactional Email (Resend / AWS SES)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_replace_with_resend_api_key
MAIL_FROM_ADDRESS=noreply@aashvo.com
```

### Frontend Variables (`.env`)

```ini
VITE_API_BASE_URL=https://api.aashvo.com/api/v1
VITE_USE_INDEPENDENT_BACKEND=true
VITE_STORAGE_PUBLIC_BASE_URL=https://media.aashvo.com
```

