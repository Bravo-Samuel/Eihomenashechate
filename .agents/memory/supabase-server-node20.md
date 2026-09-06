---
name: Supabase server auth on Node 20
description: Runtime constraint for Supabase token verification in the API server
---

When the API only needs to verify Supabase access tokens, do not create a full server-side Supabase client under the project’s Node 20 runtime unless a WebSocket transport is explicitly provided. The client can initialize Realtime eagerly, which fails when native WebSocket is unavailable and turns authenticated API requests into 500 responses.

**Why:** Realtime is not needed for bearer-token verification, and its runtime requirement can mask a healthy Supabase Auth configuration as an authentication outage.

**How to apply:** Verify bearer tokens through Supabase Auth’s `/auth/v1/user` endpoint with the publishable key and incoming bearer token, or explicitly configure a supported WebSocket transport if Realtime is genuinely required.