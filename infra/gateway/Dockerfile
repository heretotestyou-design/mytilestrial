FROM nginx:1.28-alpine
ENV NGINX_ENVSUBST_FILTER="^GATEWAY_|^SUPABASE_API_HOST$|^API_GATEWAY_SHARED_SECRET$"
COPY --chmod=755 15-validate-config.sh /docker-entrypoint.d/15-validate-config.sh
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY api-proxy.conf /etc/nginx/api-proxy.conf
COPY frontend-proxy.conf /etc/nginx/frontend-proxy.conf
