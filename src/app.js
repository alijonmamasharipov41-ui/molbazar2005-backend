const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const categoriesRouter = require("./routes/categories");
const listingsRouter = require("./routes/listings");
const usersRouter = require("./routes/users");
const uploadsRouter = require("./routes/uploads");
const favoritesRouter = require("./routes/favorites");
const chatRouter = require("./routes/chat");
const bannersRouter = require("./routes/banners");
const otpRouter = require("./routes/otp");
const adminAnalyticsRouter = require("./routes/adminAnalytics");
const analyticsPublicRouter = require("./routes/analyticsPublic");
const { errorHandler } = require("./middleware/error");

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("combined"));

// Barcha API marshrutlar /api prefiksi ostida (mobil ilova .../api/chat, .../api/auth kabi chaqiradi)
const api = express.Router();
api.use("/health", healthRouter);
api.use("/auth", authRouter);
api.use("/categories", categoriesRouter);
api.use("/listings", listingsRouter);
api.use("/users", usersRouter);
api.use("/uploads", uploadsRouter);
api.use("/favorites", favoritesRouter);
api.use("/chat", chatRouter);
api.use("/banners", bannersRouter);
api.use("/otp", otpRouter);
api.use("/analytics", analyticsPublicRouter);
api.use("/admin/analytics", adminAnalyticsRouter);
app.use("/api", api);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Not found" });
});

app.use(errorHandler);

module.exports = app;
