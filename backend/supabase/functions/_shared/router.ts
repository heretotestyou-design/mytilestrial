// A tiny, dependency-free router: `router.get("/v1/things/:id", handler)`.

export type Ctx = {
  req: Request;
  url: URL;
  params: Record<string, string>;
};

export type Handler = (ctx: Ctx) => Promise<Response> | Response;

type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

export class Router {
  private routes: Route[] = [];

  private add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = new RegExp(
      "^" +
        path.replace(/\/:([a-zA-Z_]+)/g, (_, key) => {
          keys.push(key);
          return "/([^/]+)";
        }) +
        "/?$",
    );
    this.routes.push({ method, pattern, keys, handler });
  }

  get(path: string, h: Handler) { this.add("GET", path, h); return this; }
  post(path: string, h: Handler) { this.add("POST", path, h); return this; }
  put(path: string, h: Handler) { this.add("PUT", path, h); return this; }
  patch(path: string, h: Handler) { this.add("PATCH", path, h); return this; }
  delete(path: string, h: Handler) { this.add("DELETE", path, h); return this; }

  /** Returns the handler for a path, or a reason it couldn't match. */
  match(method: string, path: string):
    | { handler: Handler; params: Record<string, string> }
    | { error: 404 | 405 } {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.pattern.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: route.handler, params };
    }
    return { error: pathMatched ? 405 : 404 };
  }
}
