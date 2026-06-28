import rateLimit from "express-rate-limit";

export const freeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.FREE_REQUESTS_PER_HOUR ?? "20"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: "Free limit reached",
      errorCode: "RATE_LIMIT",
      message: `You've used your ${process.env.FREE_REQUESTS_PER_HOUR ?? 20} free improvements this hour. Upgrade to Pro for unlimited access.`,
      upgradeUrl: "https://promptboost.in/pro",
    });
  },
});
