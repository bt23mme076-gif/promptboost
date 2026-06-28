import jwt from "jsonwebtoken";

export function requireLicense(req, res, next) {
  const licenseKey = req.headers["x-license-key"];
  if (!licenseKey) {
    return res.status(401).json({ error: "License key required", errorCode: "NO_LICENSE" });
  }
  try {
    const payload = jwt.verify(licenseKey, process.env.LICENSE_SECRET);
    req.license = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired license key", errorCode: "INVALID_LICENSE" });
  }
}

export function generateLicense(orderId, email, plan = "pro") {
  return jwt.sign(
    { orderId, email, plan, iat: Math.floor(Date.now() / 1000) },
    process.env.LICENSE_SECRET,
    { expiresIn: "365d" }
  );
}
