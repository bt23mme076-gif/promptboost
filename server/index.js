import "dotenv/config";
import express from "express";
import cors from "cors";
import improveRouter from "./routes/improve.js";
import paymentRouter from "./routes/payment.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Allow extension origins + local dev
app.use(cors({
  origin: (origin, cb) => {
    // No origin = server-to-server or curl — allow
    if (!origin) return cb(null, true);
    const allowed = [
      process.env.ALLOWED_ORIGIN,       // chrome-extension://... (set in .env for prod)
      "http://localhost:5173",
      "http://localhost:3001",
    ].filter(Boolean);
    // Always allow chrome-extension:// origins during development
    if (origin.startsWith("chrome-extension://")) return cb(null, true);
    if (allowed.some((o) => origin.startsWith(o))) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
}));

app.use(express.json({ limit: "32kb" }));

// Trust proxy (needed for correct IP rate limiting behind Nginx/Dokploy)
app.set("trust proxy", 1);

// Health check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Routes
app.use("/api", improveRouter);
app.use("/api/payment", paymentRouter);

// 404
app.use((_, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => console.log(`PromptBoost server running on :${PORT}`));
