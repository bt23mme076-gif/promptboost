import rateLimit from "express-rate-limit";

const FREE_REQUESTS_PER_DAY = parseInt(process.env.FREE_REQUESTS_PER_DAY ?? "15");

export const freeLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  max: FREE_REQUESTS_PER_DAY,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: "Free limit reached",
      errorCode: "RATE_LIMIT",
      message: `You've used your ${FREE_REQUESTS_PER_DAY} free improvements for today. Upgrade to Pro for unlimited access.`,
      upgradeUrl: "https://promptboost.atyant.in/pro",
    });
  },
});
