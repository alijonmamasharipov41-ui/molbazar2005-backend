const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { JWT_SECRET } = require("../config");

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ ok: false, error: "Token required" });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const id = decoded.id;
    const tokenVersion = decoded.tokenVersion;
    if (tokenVersion === undefined || tokenVersion === null) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const dbResult = await query(
      "SELECT id, role, COALESCE(token_version, 0) AS token_version FROM users WHERE id = $1",
      [id]
    );
    if (dbResult.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const row = dbResult.rows[0];
    if (Number(row.token_version) !== Number(tokenVersion)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    req.user = { id: row.id, role: row.role || "user" };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const tokenVersion = decoded.tokenVersion;
    if (tokenVersion === undefined || tokenVersion === null) {
      return next();
    }
    const dbResult = await query(
      "SELECT id, role, COALESCE(token_version, 0) AS token_version FROM users WHERE id = $1",
      [decoded.id]
    );
    if (dbResult.rows.length === 0) return next();
    const row = dbResult.rows[0];
    if (Number(row.token_version) !== Number(tokenVersion)) return next();
    req.user = { id: row.id, role: row.role || "user" };
  } catch (err) {
    // ignore invalid token
  }
  next();
}

module.exports = { auth, optionalAuth };
