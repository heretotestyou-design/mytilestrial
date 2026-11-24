import assert from "node:assert/strict";
import { gatewayAllows } from "./gateway.ts";
import { json } from "./http.ts";

Deno.test("the configured gateway is required for browser API requests", () => {
  const request = (key?: string) => new Request("https://example.test/v1/me", {
    headers: key ? { "x-mytiles-gateway": key } : {},
  });
  assert.equal(gatewayAllows(request(), "/v1/me"), true);
  assert.equal(gatewayAllows(request(), "/v1/me", "abc123"), false);
  assert.equal(gatewayAllows(request("abc124"), "/v1/me", "abc123"), false);
  assert.equal(gatewayAllows(request("abc123"), "/v1/me", "abc123"), true);
});

Deno.test("health and signed callbacks remain reachable directly", () => {
  for (const [method, path] of [
    ["GET", "/v1/health"],
    ["POST", "/v1/billing/webhooks/razorpay"],
    ["POST", "/v1/internal/generations/example/complete"],
  ]) {
    assert.equal(gatewayAllows(new Request("https://example.test" + path, { method }), path, "abc123"), true);
  }
});

Deno.test("API JSON is uncached by default", () => {
  const req = new Request("https://example.test/v1/me");
  assert.equal(json(req, {}).headers.get("Cache-Control"), "no-store");
  assert.equal(json(req, {}, 200, "public, s-maxage=60").headers.get("Cache-Control"), "public, s-maxage=60");
});
