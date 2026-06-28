import { Router } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { generateLicense } from "../middleware/auth.js";

const router = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /payment/order — create a Razorpay order
router.post("/order", async (req, res) => {
  const { plan = "pro_monthly" } = req.body;

  const PLANS = {
    pro_monthly: { amount: 29900, currency: "INR", description: "PromptBoost Pro — 1 Month" },
    pro_yearly:  { amount: 199900, currency: "INR", description: "PromptBoost Pro — 1 Year" },
  };

  const selected = PLANS[plan];
  if (!selected) return res.status(400).json({ error: "Invalid plan" });

  try {
    const order = await razorpay.orders.create({
      amount: selected.amount,
      currency: selected.currency,
      notes: { plan, description: selected.description },
    });
    res.json({ orderId: order.id, amount: selected.amount, currency: selected.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("[payment/order]", err);
    res.status(500).json({ error: "Could not create order" });
  }
});

// POST /payment/verify — verify payment + issue license key
router.post("/verify", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email } = req.body;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: "Invalid payment signature" });
  }

  const licenseKey = generateLicense(razorpay_order_id, email ?? "unknown");
  res.json({ success: true, licenseKey });
});

// POST /payment/verify-license — extension calls this to check if key is valid
router.post("/verify-license", (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) return res.status(400).json({ valid: false });

  try {
    const jwt = await import("jsonwebtoken");
    const payload = jwt.default.verify(licenseKey, process.env.LICENSE_SECRET);
    res.json({ valid: true, plan: payload.plan, email: payload.email });
  } catch {
    res.json({ valid: false });
  }
});

export default router;
