require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./src/routes/auth");
const productRoutes = require("./src/routes/products");
const cartRoutes = require("./src/routes/cart");
const orderRoutes = require("./src/routes/orders");

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET. Copy .env.example to .env and set one before starting.");
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  })
);
app.use(express.json({ limit: "100kb" }));

// Log requests, but redact anything that could contain a password or
// card details — never let sensitive fields reach stdout/log files.
morgan.token("safe-body", (req) => {
  const clone = { ...(req.body || {}) };
  if (clone.password) clone.password = "[redacted]";
  if (clone.payment) clone.payment = "[redacted]";
  return JSON.stringify(clone);
});
app.use(morgan(":method :url :status - :response-time ms"));

// Auth endpoints get a stricter rate limit — the classic brute-force /
// credential-stuffing target.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));

// Centralised error handler — never leak stack traces to the client.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`WatchMart API listening on http://localhost:${PORT}`);
});
