# Gateway and deployment

The browser uses the same-origin `/api/v1/?` gateway for application API requests. NGINX forwards them to the existing Supabase Edge Function over verified TLS. Supabase Auth continues to use its own host. The gateway sends page traffic to two Next.js replicas by default. Docker DNS tracks replica addresses and NGINX selects the least busy replica, retrying eligible frontend requests around failed instances.

- API requests allow 20 requests per second per client IP with a burst of 40. Render submissions and checkout creation share a separate limit of 10 per minute with a burst of 4. The Razorpay webhook uses its existing signature verification. Throttled requests receive HTTP 429 and a `Retry-After` header.
- The shared cache covers anonymous catalog and template reads and immutable Next.js assets. Catalog and templates expire after 60 and 300 seconds respectively. Requests with cookies or authorization bypass the API cache. Personalized data, payment operations, and render results use uncached responses. Render responses stream through the gateway.
- Only NGINX is bound to a host port. The Compose stack listens on host loopback and expects an HTTPS ingress on the Docker host in production. It provides frontend replica redundancy on one host.

## Run locally

Copy the repository root `.env.example` to `.env`, set the Supabase hostname and public key, and run:

```sh
docker compose up -d --build --wait
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/v1/health
```

The Docker build uses `NEXT_PUBLIC_API_URL=/api`. Existing standalone frontend development and Vercel builds can keep their current API base during migration.

## Deploy with GitHub Actions

Pushes and pull requests run frontend checks, Deno checks and tests, and a Docker gateway smoke test. Once the destination is configured, open **Actions ? CI and production deployment ? Run workflow** on `main`. Deployment runs after CI passes. The GitHub-hosted runner connects to the Docker host over SSH with host-key verification, builds release-tagged images on the host, applies pending Supabase migrations and deploys the Edge Function, then starts and probes the gateway stack.

Configure the repository's `production` environment with these values.

| Kind | Names |
| --- | --- |
| Variables | `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `SUPABASE_API_HOST`, `SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `GATEWAY_TRUSTED_PROXY_CIDR` |
| Optional variables | `DEPLOY_SSH_PORT` (22), `GATEWAY_PORT` (8080), `FRONTEND_REPLICAS` (2), `NEXT_PUBLIC_SUPPORT_WHATSAPP` |
| Secrets | `DEPLOY_SSH_KEY`, `DEPLOY_SSH_KNOWN_HOSTS`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `ADMIN_EMAILS` |
| Optional secret | `API_GATEWAY_SHARED_SECRET` |

Use a Linux host with Docker Engine and a dedicated deployment account that can access Docker. Point its HTTPS ingress at `127.0.0.1:8080` or the configured gateway port. Preserve the public Host header, replace untrusted forwarded headers, and pass the client IP in `X-Forwarded-For`. Set `GATEWAY_TRUSTED_PROXY_CIDR` to the actual ingress peer address as seen by NGINX inside the container, typically the Docker bridge gateway address with a `/32` mask. Run an external health check at `/healthz` and `/api/v1/health`.

After browser traffic has switched to the gateway, use a random 64-character hexadecimal `API_GATEWAY_SHARED_SECRET` in both the GitHub environment and the Supabase Edge Function secrets to enforce the gateway at the origin. Deploy the gateway with the secret before enabling it in Supabase. Direct health checks, existing signed Razorpay webhooks and authenticated internal callbacks continue to work. If rolling back to a frontend that calls Supabase directly, remove the Supabase gateway secret first.

[NGINX reverse proxy and cache directives](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) ? [Supabase Edge Function deployments](https://supabase.com/docs/guides/functions/deploy)
