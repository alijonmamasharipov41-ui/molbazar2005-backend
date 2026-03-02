const express = require("express");
const { query } = require("../db");
const { APP_NAME } = require("../config");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    await query("SELECT 1");
    res.json({
      ok: true,
      name: APP_NAME,
      db: "connected",
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
