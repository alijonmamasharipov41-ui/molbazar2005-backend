function errorHandler(err, req, res, next) {
  if (process.env.NODE_ENV === "production") {
    console.error("Error:", err.message || "Server error");
  } else {
    console.error(err);
  }

  // PostgreSQL CHECK (23514) yoki xabar matnida — «Boshqa e'lon» (link_type listing) uchun baza yangilanmagan
  const errMsg = typeof err.message === "string" ? err.message : "";
  if (
    err.code === "23514" ||
    errMsg.includes("banners_link_type_check") ||
    (errMsg.includes("check constraint") && errMsg.includes("banners"))
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "Banner «Boshqa e'lon» turi uchun baza yangilanmagan. Serverda bir marta: node src/server.js --migrate (037_banners_link_type_listing.sql). Yoki PostgreSQL da 037 faylidagi SQL ni qo'lda bajaring.",
    });
  }

  const message = err.message || "Server error";
  let status = err.statusCode || 500;
  if (message.includes("Invalid file type") || err.code === "LIMIT_FILE_SIZE") status = 400;
  res.status(status).json({ ok: false, error: message });
}

module.exports = { errorHandler };
