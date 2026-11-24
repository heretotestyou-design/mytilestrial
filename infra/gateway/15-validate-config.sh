#!/bin/sh
set -eu

case "${SUPABASE_API_HOST:-}" in
  ''|*[!a-zA-Z0-9.-]*) echo "SUPABASE_API_HOST must be a DNS hostname." >&2; exit 1 ;;
esac
case "${GATEWAY_PUBLIC_SCHEME:-}" in
  http|https) ;;
  *) echo "GATEWAY_PUBLIC_SCHEME must be http or https." >&2; exit 1 ;;
esac
case "${GATEWAY_TRUSTED_PROXY_CIDR:-}" in
  ''|*[!a-fA-F0-9:./]*) echo "GATEWAY_TRUSTED_PROXY_CIDR must be an IP or CIDR." >&2; exit 1 ;;
esac
case "${API_GATEWAY_SHARED_SECRET:-}" in
  *[!a-fA-F0-9]*) echo "API_GATEWAY_SHARED_SECRET must be hexadecimal." >&2; exit 1 ;;
esac
