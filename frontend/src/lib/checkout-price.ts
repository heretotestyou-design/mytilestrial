export const GST_PERCENT = 18;

export function checkoutPrice(base: number, testPack = false) {
  const tax = testPack ? 0 : Math.round(base * GST_PERCENT / 100);
  return { base, tax, total: base + tax };
}

export function packCheckoutPrice(pack: { price_paise: number; is_test?: boolean }) {
  return checkoutPrice(Number(pack.price_paise), pack.is_test);
}
