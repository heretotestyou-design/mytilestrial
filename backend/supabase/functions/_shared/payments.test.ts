import assert from "node:assert/strict";
import { getPaymentProvider, hmacSha256Hex, isValidWebhookSignature } from "./payments.ts";

const provider = getPaymentProvider("razorpay");
const order = { providerOrderId: "order_fixture123", amountPaise: 176882, currency: "INR" };
const paymentId = "pay_fixture123";
const fixtureSecret = crypto.randomUUID();
const captured = { id: paymentId, order_id: order.providerOrderId, amount: order.amountPaise, currency: order.currency, status: "captured" };

async function withProviderMock(run: () => Promise<void>, mock: typeof fetch) {
  const originalFetch = globalThis.fetch;
  const id = Deno.env.get("RAZORPAY_KEY_ID");
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
  Deno.env.set("RAZORPAY_KEY_ID", "fixture-merchant");
  Deno.env.set("RAZORPAY_KEY_SECRET", fixtureSecret);
  globalThis.fetch = mock;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (id === undefined) Deno.env.delete("RAZORPAY_KEY_ID");
    else Deno.env.set("RAZORPAY_KEY_ID", id);
    if (secret === undefined) Deno.env.delete("RAZORPAY_KEY_SECRET");
    else Deno.env.set("RAZORPAY_KEY_SECRET", secret);
  }
}

Deno.test("signed captured checkout verifies against the saved order and amount", async () => {
  const signature = await hmacSha256Hex(fixtureSecret, `${order.providerOrderId}|${paymentId}`);
  await withProviderMock(async () => {
    const verified = await provider.verifyPayment({ ...order, providerPaymentId: paymentId, signature });
    assert.equal(verified.providerPaymentId, paymentId);
  }, (input) => {
    assert.equal(String(input), `https://api.razorpay.com/v1/payments/${paymentId}`);
    return Promise.resolve(Response.json(captured));
  });
});

Deno.test("signature mismatch stops before calling Razorpay", async () => {
  await withProviderMock(async () => {
    await assert.rejects(provider.verifyPayment({ ...order, providerPaymentId: paymentId, signature: "0".repeat(64) }),
      { code: "PAYMENT_NOT_VERIFIED", message: "Payment signature is invalid." });
  }, () => assert.fail("Unexpected provider request"));
});

Deno.test("provider confirmation rejects wrong orders, totals, currencies and incomplete payments", async () => {
  for (const override of [
    { order_id: "order_other123" }, { amount: 149900 }, { currency: "USD" }, { status: "failed" }, { status: "refunded" },
  ]) {
    await withProviderMock(async () => {
      await assert.rejects(provider.verifyPayment(order), { code: "PAYMENT_NOT_VERIFIED" });
    }, () => Promise.resolve(Response.json({ items: [{ ...captured, ...override }] })));
  }
});

Deno.test("authorized orders capture the exact requested amount before settlement", async () => {
  let requests = 0;
  await withProviderMock(async () => {
    assert.equal((await provider.verifyPayment(order)).providerPaymentId, paymentId);
    assert.equal(requests, 2);
  }, (input, init) => {
    requests++;
    if (requests === 1) return Promise.resolve(Response.json({ items: [{ ...captured, status: "authorized" }] }));
    assert.ok(String(input).endsWith(`/payments/${paymentId}/capture`));
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { amount: order.amountPaise, currency: order.currency });
    return Promise.resolve(Response.json(captured));
  });
});

Deno.test("webhook signatures are tied to the raw body", async () => {
  const body = '{"event":"payment.captured"}';
  const signature = await hmacSha256Hex(fixtureSecret, body);
  assert.equal(await isValidWebhookSignature(fixtureSecret, body, signature), true);
  assert.equal(await isValidWebhookSignature(fixtureSecret, body + " ", signature), false);
  assert.equal(await isValidWebhookSignature(fixtureSecret, body, null), false);
});
