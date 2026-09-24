// Minimal file-based JSON "database".
//
// Why not a real database here? This project is a teaching/demo backend.
// A flat JSON file with an in-process write lock keeps the whole data
// layer readable in one file, needs zero native compilation (unlike
// sqlite3/better-sqlite3), and is trivial to swap out later — every
// function below is the seam you'd replace with real Postgres/Mongo
// queries in production. Do not use this file store for a real app
// with concurrent users.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  carts: path.join(DATA_DIR, "carts.json"),
  orders: path.join(DATA_DIR, "orders.json"),
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const file of Object.values(FILES)) {
    if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf8");
  }
}

function readAll(name) {
  ensureStore();
  const raw = fs.readFileSync(FILES[name], "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Single-process write "lock" via a promise chain — good enough for a
// demo server with no clustering. A real deployment needs a real DB
// with actual transactions instead of this.
let writeQueue = Promise.resolve();
function writeAll(name, data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(FILES[name], JSON.stringify(data, null, 2), "utf8", (err) =>
          err ? reject(err) : resolve()
        );
      })
  );
  return writeQueue;
}

const PRODUCTS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "products.seed.json"), "utf8")
);

module.exports = { readAll, writeAll, PRODUCTS };
