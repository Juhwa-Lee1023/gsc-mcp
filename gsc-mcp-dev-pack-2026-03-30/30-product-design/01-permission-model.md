# Permission model

## Four layers of permission

### 1. Google scope
- `webmasters.readonly`
- `webmasters`

This determines what the Google API will allow.

### 2. Property allowlist
Local configuration defines which properties this server may expose at all.

### 3. Tool capability flag
Even if Google auth allows writes, the server can still disable write tools globally or per deployment.

### 4. Optional confirmation token
For write operations, require a short-lived confirmation token derived from the exact payload to prevent accidental or model-driven destructive actions.

## Recommended config shape
```yaml
properties:
  - alias: main
    siteUrl: sc-domain:example.com
    allowRead: true
    allowWrite: false

toolPolicy:
  enabledTools:
    - gsc.sites.list
    - gsc.performance.query
  disabledTools:
    - gsc.sites.delete
```

## Why this is better than relying only on scopes
Scopes are too coarse.
A user may have wide account access, but the server should expose only a narrow operational slice.
