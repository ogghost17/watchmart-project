const express = require("express");
const crypto = require("crypto");
const { readAll, writeAll, PRODUCTS } = require("../db");
const { requireAuth } = require("../middleware/auth");
const {
  luhnCheck,
  detectCardBrand,
  last4,
  isFutureExpiry,
} = require("../utils/validators");

const router = express.Router();
router.use(requireAuth);

/**
 * IMPORTANT — read this before reusing this file for anything real.
 *
 * This endpoint accepts a card number so the demo has an end-to-end
 * "enter your card" flow like a real storefront. What it does NOT do,
 * on purpose:
 *   - It never writes the full card number or CVV to disk, to a log,
 *     or anywhere else. They exist only in this request's memory and
 *     are discarded the moment this function returns.
 *   - It never sends the card number anywhere. There is no real
 *     payment gateway wired up — `mockChargeCard` below just returns
 *     a fake result.
 *   - It only ever persists brand + last 4 digits, which is what a
 *     receipt is allowed to show.
 *
 * In a real product you would NEVER collect raw card numbers on your
 * own server at all — you'd use your payment processor's hosted
 * field / client-side SDK (e.g. Paystack Inline, Flutterwave, Stripe
 * Elements) so the PAN and CVV go straight from the customer's
 * browser to the processor and your server only ever sees a token.
 * That's what real PCI-DSS scope reduction looks like.
 */
function mockChargeCard({ amount }) {
  // No network call, no third party — this is a deterministic stand-in
  // so the checkout flow can be demoed offline. Swap this function's
  // body for a real gateway SDK call when you're ready to go live.
  const approved = true; // demo always approves; flip to simulate declines
  return {
    approved,
    reference: "MOCK-" + crypto.randomBytes(6).toString("hex").toUpperCase(),
    amountCharged: amount,
  };
}

router.post("/checkout", async (req, res) => {
  const { shipping, payment } = req.body || {};

  // ---- validate shipping -------------------------------------------------
  const requiredShipping = ["fullName", "address", "city", "country"];
  if (!shipping || requiredShipping.some((f) => !shipping[f] || !String(shipping[f]).trim())) {
    return res.status(400).json({ error: "Please complete your shipping address." });
  }

  // ---- validate card WITHOUT ever storing it -----------------------------
  const card = payment || {};
  const cardNumber = String(card.number || "").replace(/\D/g, "");
  if (!luhnCheck(cardNumber)) {
    return res.status(400).json({ error: "That card number doesn't look valid." });
  }
  if (!isFutureExpiry(card.expMonth, card.expYear)) {
    return res.status(400).json({ error: "That card's expiry date is invalid or in the past." });
  }
  if (!/^\d{3,4}$/.test(String(card.cvv || ""))) {
    return res.status(400).json({ error: "That security code doesn't look valid." });
  }
  if (!card.name || !String(card.name).trim()) {
    return res.status(400).json({ error: "Please provide the name on the card." });
  }

  // ---- price the order server-side; never trust a client-supplied total -
  const carts = await readAll("carts");
  const cart = carts.find((c) => c.userId === req.user.id);
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }
  const lineItems = cart.items
    .map(({ productId, qty }) => {
      const product = PRODUCTS.find((p) => p.id === productId);
      return product ? { productId, name: product.name, unitPrice: product.price, qty } : null;
    })
    .filter(Boolean);
  const total = lineItems.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);

  // ---- "charge" the card, then immediately forget its digits ------------
  const brand = detectCardBrand(cardNumber);
  const maskedLast4 = last4(cardNumber);
  const chargeResult = mockChargeCard({ amount: total });
  // cardNumber / card.cvv go out of scope here and are never referenced again.

  if (!chargeResult.approved) {
    return res.status(402).json({ error: "Payment was declined. Please try another card." });
  }

  const order = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    items: lineItems,
    total,
    shipping,
    payment: { brand, last4: maskedLast4, reference: chargeResult.reference },
    status: "confirmed",
    placedAt: new Date().toISOString(),
  };

  const orders = await readAll("orders");
  orders.push(order);
  await writeAll("orders", orders);

  // clear the cart
  cart.items = [];
  await writeAll("carts", carts);

  res.status(201).json({ order });
});

router.get("/", async (req, res) => {
  const orders = await readAll("orders");
  res.json(orders.filter((o) => o.userId === req.user.id));
});

module.exports = router;
