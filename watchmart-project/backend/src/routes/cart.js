const express = require("express");
const { readAll, writeAll, PRODUCTS } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

async function getCartsFile() {
  return readAll("carts");
}

function findOrCreateCart(carts, userId) {
  let cart = carts.find((c) => c.userId === userId);
  if (!cart) {
    cart = { userId, items: [] }; // items: [{ productId, qty }]
    carts.push(cart);
  }
  return cart;
}

function hydrate(cart) {
  const items = cart.items
    .map(({ productId, qty }) => {
      const product = PRODUCTS.find((p) => p.id === productId);
      if (!product) return null;
      return { product, qty, lineTotal: product.price * qty };
    })
    .filter(Boolean);
  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  return { items, subtotal };
}

router.get("/", async (req, res) => {
  const carts = await getCartsFile();
  const cart = findOrCreateCart(carts, req.user.id);
  res.json(hydrate(cart));
});

router.post("/", async (req, res) => {
  const { productId, qty } = req.body || {};
  const quantity = Number.isInteger(qty) ? qty : 1;
  if (quantity < 1 || quantity > 20) {
    return res.status(400).json({ error: "Quantity must be between 1 and 20." });
  }
  if (!PRODUCTS.some((p) => p.id === productId)) {
    return res.status(404).json({ error: "Unknown product." });
  }

  const carts = await getCartsFile();
  const cart = findOrCreateCart(carts, req.user.id);
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) existing.qty = quantity;
  else cart.items.push({ productId, qty: quantity });

  await writeAll("carts", carts);
  res.status(201).json(hydrate(cart));
});

router.delete("/:productId", async (req, res) => {
  const carts = await getCartsFile();
  const cart = findOrCreateCart(carts, req.user.id);
  cart.items = cart.items.filter((i) => i.productId !== req.params.productId);
  await writeAll("carts", carts);
  res.json(hydrate(cart));
});

module.exports = router;
