import assert from "node:assert/strict";
import { paymentReceiptHtml } from "./payment-receipt.ts";

const payment = {
  id: "receipt-example",
  pack_id: "studio",
  amount_paise: 589882,
  base_amount_paise: 499900,
  currency: "INR",
  credits: 400,
  paid_at: "2026-11-23T20:00:00Z",
  credits_expire_at: null,
  provider: "razorpay",
  provider_order_id: "order_example",
  provider_payment_id: "pay_example",
};

Deno.test("renders amounts from the confirmed record and escapes buyer details", () => {
  const html = paymentReceiptHtml(payment, {
    full_name: "<script>name</script>",
    company: "A & B",
    email: "buyer@example.test",
    gstin: null,
  });
  assert.match(html, /24 November 2026/);
  assert.match(html, /₹4,999\.00/);
  assert.match(html, /₹899\.82/);
  assert.match(html, /₹5,898\.82/);
  assert.match(html, /pay_example/);
  assert.match(html, /&lt;script&gt;name&lt;\/script&gt;/);
  assert.match(html, /A &amp; B/);
  assert.doesNotMatch(html, /<script>|order_example/);
});

Deno.test("supports legacy payments without inventing a tax breakdown", () => {
  const html = paymentReceiptHtml({ ...payment, base_amount_paise: null }, null);
  assert.match(html, /₹5,898\.82/);
  assert.match(html, /tax breakdown is unavailable/);
  assert.doesNotMatch(html, /<dt>GST<\/dt>|Billed to/);
});

Deno.test("labels test payments and sample invoices explicitly", () => {
  const testReceipt = paymentReceiptHtml(payment, null, "test");
  assert.match(testReceipt, /Test payment receipt/);
  assert.match(testReceipt, /No funds were collected/);
  assert.doesNotMatch(testReceipt, /Total paid/);
  const sample = paymentReceiptHtml(payment, null, "sample");
  assert.match(sample, /Sample only/);
  assert.match(sample, /No payment was made/);
});
