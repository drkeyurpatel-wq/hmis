---
description: "Health1 security rules — PHI/PII protection for healthcare applications"
alwaysApply: true
---

# Security Rules — Health1 Healthcare Stack

## PHI/PII Protection — Mandatory

- Pre-commit: scan for PHI patterns (patient name, DOB, Aadhaar, phone)
- HMIS: all Supabase queries MUST go through RLS — no service_role key in client code
- MedPay: doctor financial data is PII — encrypt at rest, audit access logs
- CashFlow: D1 write operations require explicit payload display + confirmation
- HRMS: employee salary data is PII — encrypt at rest, audit trail for payroll
- No PHI/PII in error messages, logs, or console output
- Audit trail required for every data modification in HMIS
- All API routes must require authentication
- Session timeout required for clinical users

## Secret Management

- Never hardcode API keys, tokens, or credentials
- Use .env.local for local secrets — never commit .env files
- Supabase anon key in client code is acceptable; service_role key is NOT
- Rotate any token exposed in logs, chat, or commits immediately

## Input Validation

- Parameterized queries only — no string concatenation for SQL
- Sanitize all user input before rendering (XSS prevention)
- Validate file uploads: type, size, content inspection
- Rate limit API endpoints exposed to public

## CORS and Headers

- CORS: configured per-domain, never wildcard `*` in production
- CSP headers on all pages
- Secure cookie flags: HttpOnly, Secure, SameSite
