import "dotenv/config";
import express from "express";
import cors from "cors";
import improveRouter from "./routes/improve.js";
import paymentRouter from "./routes/payment.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Only allow requests from the Chrome extension
app.use(cors({
  origin: (origin, cb) => {
    const allowed = [
      process.env.ALLOWED_ORIGIN,   // chrome-extension://...
      "http://localhost:5173",       // local dev
    ].filter(Boolean);
    if (!origin || allowed.some((o) => origin.startsWith(o))) return cb(null, true);
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
