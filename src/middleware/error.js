function errorHandler(err, req, res, next) {
  console.error(err);
  const message = err.message || "Server error";
  let status = err.statusCode || 500;
  if (message.includes("Invalid file type") || err.code === "LIMIT_FILE_SIZE") status = 400;
  res.status(status).json({ ok: false, error: message });
}

module.exports = { errorHandler };
