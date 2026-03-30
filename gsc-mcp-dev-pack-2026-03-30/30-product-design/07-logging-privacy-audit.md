# Logging, privacy, and audit

## Log these
- timestamp
- tool name
- site alias
- success / failure
- latency
- quota/backoff events
- policy denials
- normalized request class (summary/detail, freshness, cost class)

## Redact or hash these
- raw queries
- raw page URLs where possible
- access tokens
- refresh tokens
- full error payloads if they may leak sensitive values

## Keep separate
- operational logs
- audit events
- debug traces

## Audit events worth storing
- auth login / upgrade
- allowlist changes
- write-tool enable / disable
- write invocation attempts
- policy denials
- token refresh failures
