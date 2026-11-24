type ReceiptPayment = {
  id: string;
  pack_id: string;
  amount_paise: number;
  base_amount_paise: number | null;
  currency: string;
  credits: number;
  paid_at: string;
  credits_expire_at: string | null;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
};

type ReceiptContact = {
  full_name: string;
  company: string | null;
  email: string;
  gstin: string | null;
};

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char] ?? char));

const date = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
});

export function paymentReceiptHtml(
  payment: ReceiptPayment,
  contact: ReceiptContact | null,
  mode: "paid" | "test" | "sample" = "paid",
): string {
  const title = mode === "sample" ? "Sample invoice" : mode === "test" ? "Test payment receipt" : "Payment receipt";
  const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: payment.currency });
  const format = (paise: number) => escape(money.format(paise / 100));
  const base = payment.base_amount_paise;
  const hasBreakdown = base !== null && base >= 0 && base <= payment.amount_paise;
  const gst = hasBreakdown ? payment.amount_paise - base : null;
  const pack = escape(payment.pack_id.replaceAll("-", " "));
  const detail = (label: string, value: string) => `<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`;
  const line = (label: string, value: string) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const buyer = contact ? `
    <section class="buyer">
      <h2>Billed to</h2>
      <strong>${escape(contact.full_name)}</strong>
      ${contact.company ? `<div>${escape(contact.company)}</div>` : ""}
      <div>${escape(contact.email)}</div>
      ${contact.gstin ? `<div>GSTIN ${escape(contact.gstin)}</div>` : ""}
    </section>` : "";
  const paymentReference = payment.provider_payment_id ?? payment.provider_order_id;
  const provider = payment.provider === "razorpay" ? "Razorpay" : "Test payments";

  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <title>${title} · MyTilesTrial</title>
  <style>
    @page { size:A4; margin:16mm; }
    * { box-sizing:border-box; }
    html { color:#24221f; background:#f4f1eb; font:15px/1.5 Arial,sans-serif; }
    body { margin:0; }
    main { max-width:760px; margin:24px auto; padding:40px; background:white; border:1px solid #e4ddd2; }
    header { display:flex; justify-content:space-between; gap:14px; align-items:center; border-bottom:2px solid #a47647; padding-bottom:20px; }
    .brand { font-size:24px; font-weight:750; letter-spacing:-.03em; }
    .badge { background:#ebf3ec; color:#21573c; border-radius:30px; padding:5px 12px; font-size:12px; font-weight:bold; white-space:nowrap; }
    .badge.preview { background:#f7eee1; color:#815426; }
    h1 { font-size:37px; letter-spacing:-.045em; line-height:1.1; margin:26px 0 18px; }
    h2, dt { margin:0 0 4px; color:#615c54; font-size:12px; font-weight:600; }
    dl { margin:0; }
    dd { margin:0; }
    .meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 20px; overflow-wrap:anywhere; }
    .buyer { margin:24px 0 16px; overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; margin-top:26px; }
    th { background:#f4f1eb; color:#615c54; text-align:left; font-size:12px; }
    th, td { padding:13px 12px; }
    th:last-child, td:last-child { text-align:right; white-space:nowrap; }
    td { border-bottom:1px solid #e4ddd2; }
    .pack { text-transform:capitalize; }
    .muted { color:#615c54; font-size:13px; }
    .totals { margin:16px 0 0 auto; max-width:310px; font-variant-numeric:tabular-nums; }
    .totals div { display:flex; justify-content:space-between; gap:12px; padding:5px 0; }
    .totals dt { font-size:14px; margin:0; }
    .totals .total { border-top:1px solid #c5b49d; padding-top:10px; margin-top:5px; font-size:19px; font-weight:bold; }
    .total dt { color:#24221f; font-size:16px; }
    footer { border-top:1px solid #e4ddd2; margin-top:22px; padding-top:12px; }
    footer p { margin:3px 0; }
    @media(max-width:540px) { main { margin:0; padding:20px; border:0; } h1 { font-size:29px; } }
    @media print { html { background:white; print-color-adjust:exact; -webkit-print-color-adjust:exact; } main { margin:0; padding:12px 0 0; max-width:none; border:0; } header, .buyer, .totals, footer { break-inside:avoid; } }
  </style>
</head>
<body>
<main>
  <header><div><div class="brand">MyTilesTrial</div><div class="muted">TrinoGenz</div></div>
    <span class="badge${mode === "paid" ? "" : " preview"}">${mode === "paid" ? "Paid" : mode === "sample" ? "Sample only" : "Test mode"}</span>
  </header>
  <h1>${title}</h1>
  <dl class="meta">
    ${detail("Receipt reference", payment.id)}
    ${detail("Payment date", date.format(new Date(payment.paid_at)))}
    ${detail("Payment method", provider)}
    ${paymentReference ? detail("Payment reference", paymentReference) : ""}
  </dl>
  ${buyer}
  <table>
    <thead><tr><th scope="col">Description</th><th scope="col">Amount</th></tr></thead>
    <tbody><tr><td><strong class="pack">${pack} image pack</strong>
      <div class="muted">${payment.credits.toLocaleString("en-IN")} images${payment.credits_expire_at ? ` · expires ${date.format(new Date(payment.credits_expire_at))}` : ""}</div>
      </td><td>${format(hasBreakdown ? base : payment.amount_paise)}</td></tr></tbody>
  </table>
  <dl class="totals">
    ${hasBreakdown ? line("Subtotal", format(base)) : ""}
    ${gst !== null && gst > 0 ? line("GST", format(gst)) : ""}
    <div class="total"><dt>${mode === "sample" ? "Example total" : mode === "test" ? "Test total" : "Total paid"}</dt><dd>${format(payment.amount_paise)}</dd></div>
  </dl>
  <footer class="muted">
    ${mode === "sample" ? "<p>Illustrative payment receipt. No payment was made.</p>" : mode === "test" ? "<p>Test payment. No funds were collected.</p>" : ""}
    ${!hasBreakdown ? "<p>A tax breakdown is unavailable for this payment.</p>" : ""}
    <p>Payment support · connect@trinogenz.com</p>
  </footer>
</main>
</body>
</html>`;
}
