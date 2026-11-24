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

The **CI** workflow runs on pushes and pull requests. It scans for committed secrets, checks frontend and backend code quality, runs the frontend and backend test suites in order, then builds the Docker stack and tests the gateway. Download the frontend and backend JUnit reports from the workflow run. CI uses disposable build fixtures and requires no production credentials.

Open **Actions ? CD ? Run workflow** on `main` to run CI and deploy the selected commit to staging. The workflow checks the staging site over HTTPS and verifies that its catalog reports the configured staging payment provider. Select **promote_to_production** to deploy the same commit to production after staging succeeds. GitHub environment reviewers, if configured on `production`, can review staging before approving the promotion.

### Configure staging and production

Create a separate Supabase project and HTTPS origin for staging. Set the repository Actions variable `STAGING_SUPABASE_PROJECT_REF` to its project reference. In the staging environment, set `SUPABASE_PROJECT_REF` to the same reference and `SUPABASE_API_HOST` to `<staging-project-ref>.supabase.co`. This check keeps staging pointed at its own database. Add the staging site's `/auth/callback` and `/reset-password` URLs to the staging Supabase Auth redirect allowlist. By default, staging uses the dummy payment provider and permits test purchases for addresses in its `ADMIN_EMAILS` list. To exercise Razorpay checkout and guest activation, set `RAZORPAY_TEST_KEY_ID` and `RAZORPAY_TEST_KEY_SECRET` in the GitHub staging environment. The workflow accepts only a key ID beginning with `rzp_test_`. Set `RAZORPAY_TEST_WEBHOOK_SECRET` when using a Razorpay test webhook pointed at the staging project.

Configure the following values separately in the GitHub `staging` and `production` environments.

| Kind | Names |
| --- | --- |
| Variables | `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `SUPABASE_API_HOST`, `SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `GATEWAY_TRUSTED_PROXY_CIDR` |
| Optional variables | `DEPLOY_SSH_PORT` (22), `GATEWAY_PORT` (8081 in staging, 8080 in production), `FRONTEND_REPLICAS` (2), `NEXT_PUBLIC_SUPPORT_WHATSAPP` |
| Secrets | `DEPLOY_SSH_KEY`, `DEPLOY_SSH_KNOWN_HOSTS`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `ADMIN_EMAILS` |
| Optional secret | `API_GATEWAY_SHARED_SECRET` |

Use a Linux host with Docker Engine and a dedicated deployment account that can access Docker. Point each HTTPS origin at its configured loopback gateway port. Separate Compose project names and image tags keep the environments isolated when they share a Docker host. Use distinct gateway ports on a shared host. Preserve the public Host header, replace untrusted forwarded headers, and pass the client IP in `X-Forwarded-For`. Set `GATEWAY_TRUSTED_PROXY_CIDR` to the actual ingress peer address as seen by NGINX inside the container, typically the Docker bridge gateway address with a `/32` mask. Run an external health check at `/healthz` and `/api/v1/health`.

After browser traffic has switched to the gateway, use a random 64-character hexadecimal `API_GATEWAY_SHARED_SECRET` in both the GitHub environment and the Supabase Edge Function secrets to enforce the gateway at the origin. Deploy the gateway with the secret before enabling it in Supabase. Direct health checks, existing signed Razorpay webhooks and authenticated internal callbacks continue to work. If rolling back to a frontend that calls Supabase directly, remove the Supabase gateway secret first.

## Application tests and health reports

CI runs frontend tests, Deno backend tests, disposable PostgreSQL integration tests, monitor tests, and the Docker gateway smoke test.

| Coverage | Checks |
| --- | --- |
| Frontend | Sign-in and OTP, session guards, landing and website checkout, payment result screens, templates and studio workflows |
| Razorpay | Captured payments, order and amount matching, currency checks, authorised capture, and tampered signatures |
| PostgreSQL | GST totals, confirming a payment once, rollover and expiry on plan changes, guest checkout settlement, and render charges and refunds |
| Production monitor | Homepage, landing, login, API health, pricing catalog, templates, and authentication on account and Floor Planner routes |

The **App health monitor** checks production hourly and prepares a daily report at **9:07 AM IST**. The report includes the latest checks and scheduled run failures over the previous 24 hours. GitHub Actions archives each report. A manual workflow run previews the report in Actions. The probes use public pages and signed-out API requests.

Set repository Actions variables `MONITOR_SITE_URL` and `MONITOR_API_URL` to the production site and API base URLs. To enable Gmail delivery, set the repository Actions secrets `MONITOR_GMAIL_ADDRESS`, `MONITOR_GMAIL_APP_PASSWORD`, and `MONITOR_GMAIL_RECIPIENT`. Use a Gmail sender with 2-Step Verification and a dedicated app password. [Google account help](https://support.google.com/mail/answer/185833)

[NGINX reverse proxy and cache directives](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) ? [Supabase Edge Function deployments](https://supabase.com/docs/guides/functions/deploy)
