# 🔁 Secret Rotation Runbook

## Overview
This runbook documents how to rotate JWT secrets, cookie secrets, and database credentials **without downtime**.

---

## 📋 Pre-Rotation Checklist

- [ ] Notify the team of the scheduled rotation
- [ ] Ensure monitoring dashboards are visible
- [ ] Verify backup systems are operational
- [ ] Test the rotation in staging first

---

## 🔑 JWT Secret Rotation

### Step 1: Generate New Secrets
```bash
# Generate cryptographically secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 2: Update Secrets in Vault / Docker Secrets
```bash
# If using Docker Secrets:
echo "new-jwt-secret" | docker secret create jwt_secret_v2 -

# If using HashiCorp Vault:
vault kv put secret/auth jwt_secret="new-jwt-secret"
```

### Step 3: Deploy with New Secrets
```bash
docker compose up -d --no-deps app
```

### Step 4: Mass Revoke Old Tokens
```bash
# All existing tokens were signed with the old secret — they are now invalid anyway.
# But explicitly revoke to clean up Redis + MongoDB:
node scripts/massRevoke.js --all
```

### Step 5: Verify
- [ ] New logins succeed with new tokens
- [ ] Old tokens are rejected
- [ ] Health check passes: `curl http://localhost:3000/api/health`

---

## 🍪 Cookie Secret Rotation

1. Update `COOKIE_SECRET` in secrets manager
2. Redeploy the application
3. Existing signed cookies will fail validation — users will need to re-login

---

## 🗄️ Database Credential Rotation

1. Create new database user with new credentials
2. Update `MONGO_URI` and `REDIS_URI` in secrets manager
3. Redeploy with new credentials
4. Verify database connectivity
5. Drop old database user

---

## 🚨 Emergency Rotation (Compromised Secrets)

If secrets are compromised:

1. **Immediately** generate and deploy new secrets
2. Run mass token revocation:
   ```bash
   node scripts/massRevoke.js --all
   ```
3. Force all users to re-authenticate
4. Investigate the breach source
5. Document the incident

---

## ✅ Post-Rotation Verification

- [ ] Application starts without errors
- [ ] New user registration works
- [ ] Login / logout flow works
- [ ] Token refresh works
- [ ] Admin endpoints accessible
- [ ] Structured logs show normal activity
- [ ] No elevated error rates in monitoring
