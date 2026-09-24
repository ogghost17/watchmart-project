const express = require("express");
const { PRODUCTS } = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(PRODUCTS);
});

router.get("/:id", (req, res) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found." });
  res.json(product);
});

module.exports = router;
