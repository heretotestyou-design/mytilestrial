# MyTilesTrial

[Gateway, Docker and CI/CD setup](infra/README.md)

## Landing checkout and admin access

Paid-pack links open an in-page dialog. A link such as `/landing?buy=studio#pricing` reopens the same plan for a follow-up or repeat purchase. Landing buyers enter their name, company, email and mobile number before Razorpay. The details are saved in Supabase and mirrored to Google Sheets when configured. After confirmed payment, a new buyer receives a Supabase Auth invitation to set a password. Existing verified buyers keep their account and password.

On the homepage, the same dialog creates or signs into a password-based account before opening Razorpay. Public paid prices add 18% GST. The checkout displays the final total, and the API grants credits only after matching and verifying the Razorpay payment against the saved order.

For account activation and password resets, use working Supabase Auth email delivery and add `https://mytilestrial.com/reset-password` and the site's `/auth/callback` redirect to the Auth redirect allowlist. Use `MYTILESTRIAL_SITE_URL` on the Edge Function if the activation link should point to a different site.

Deploy the checkout migration and the updated Supabase `api` Edge Function along with the frontend. Keep the existing Razorpay configuration and hosted webhook.

### Google Sheets

1. Enable the Google Sheets API for a Google Cloud project and create a service account. Share a private spreadsheet with its email address as **Editor**.
2. In the spreadsheet, create a dedicated `Checkout` tab. Use a separate tab for sorting or reports so the integration can keep writing each checkout to its assigned row.
3. Configure `GOOGLE_SHEETS_ID` and `GOOGLE_SHEETS_SERVICE_ACCOUNT` in the Supabase Edge Function secrets. The latter is the complete service account JSON. Set `GOOGLE_SHEETS_TAB` if you chose a different tab name. Keep the JSON out of browser variables and version control.
4. Open **Recent checkouts** in `/admin` to see sync status. **Sync pending rows** retries up to 50 saved submissions per click. Repeated syncs write the same rows.

### Admin users

Set the server-side `ADMIN_EMAILS` secret to a comma-separated list of verified admin email addresses, then sign in at `/admin/login`. The admin API checks that list on every request.
