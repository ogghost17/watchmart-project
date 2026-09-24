const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { readAll, writeAll } = require("../db");
const { isValidEmail, isStrongEnoughPassword } = require("../utils/validators");

const router = express.Router();
const SALT_ROUNDS = 12;

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
  });
}

function publicUser(user) {
  // Never send the password hash back to the client.
  const { id, name, email, createdAt } = user;
  return { id, name, email, createdAt };
}

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ error: "Please provide your full name." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }
  if (!isStrongEnoughPassword(password)) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters and include a letter and a number." });
  }

  const users = await readAll("users");
  const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    // Same message as "wrong password" below would be used for login,
    // but for registration it's fine (and expected) to say the email
    // is taken — the risk here is account-squatting, not enumeration.
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeAll("users", users);

  const token = issueToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const users = await readAll("users");
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  // Deliberately generic error + constant-shape work on both branches so
  // a failed lookup and a failed password check aren't distinguishable
  // by response timing alone (basic defence against user enumeration).
  const dummyHash = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO9L5ZfR0Q9r7Q2wxOxhQ2v1z1G1z1G1u";
  const hashToCheck = user ? user.passwordHash : dummyHash;
  const matches = await bcrypt.compare(password, hashToCheck);

  if (!user || !matches) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = issueToken(user);
  res.json({ token, user: publicUser(user) });
});

module.exports = router;
