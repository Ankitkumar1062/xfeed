const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 8000;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
    credentials: false,
  })
);

app.use(express.json());

const trackingData = new Map();
const senderAccessTimes = new Map(); // Track sender access patterns
const receiverEvents = new Map(); // Only store receiver events

// Enhanced function to detect sender vs receiver
function logTrackingData(trackingId, req) {
  const timestamp = Date.now();
  const userAgent = req.get("User-Agent") || "";
  const ip = req.headers["x-forwarded-for"] || req.connection?.remoteAddress;
  const referer = req.get("Referer") || "";

  console.log(`🔍 DEBUG - TrackingId: ${trackingId}`);
  console.log(`🔍 DEBUG - UserAgent: ${userAgent}`);
  console.log(`🔍 DEBUG - Referer: ${referer}`);

  // Enhanced bot detection - EXCLUDE Google Image Proxy from bot detection
  const isBot =
    (userAgent.toLowerCase().includes("bot") ||
      userAgent.toLowerCase().includes("crawler") ||
      userAgent.toLowerCase().includes("spider") ||
      userAgent.toLowerCase().includes("gmail") ||
      userAgent.toLowerCase().includes("outlook")) &&
    !userAgent.includes("GoogleImageProxy") &&
    !userAgent.includes("ggpht.com");

  // Enhanced real browser detection - INCLUDE Google Image Proxy as legitimate
  const isRealBrowser =
    userAgent.includes("GoogleImageProxy") ||
    userAgent.includes("ggpht.com") ||
    (userAgent.includes("Mozilla") &&
      (userAgent.includes("Chrome") ||
        userAgent.includes("Firefox") ||
        userAgent.includes("Safari")) &&
      !isBot);

  console.log(`🔍 DEBUG - isBot: ${isBot}, isRealBrowser: ${isRealBrowser}`);

  // Sender detection patterns
  const isSenderAccess =
    // Gmail compose/sent folder patterns
    (referer.includes("mail.google.com") &&
      (referer.includes("compose") || referer.includes("sent"))) ||
    // Outlook compose patterns
    (referer.includes("outlook") && referer.includes("compose")) ||
    // Very quick access (likely sender checking)
    (senderAccessTimes.has(trackingId) &&
      timestamp - senderAccessTimes.get(trackingId) < 5000) ||
    // Known email client prefetch patterns
    userAgent.includes("Thunderbird") ||
    userAgent.includes("Mail/");

  // Track potential sender access
  if (!senderAccessTimes.has(trackingId)) {
    senderAccessTimes.set(trackingId, timestamp);

    // If this looks like sender access, mark it and skip logging
    if (isSenderAccess || isBot || !isRealBrowser) {
      console.log(
        `👤 Sender/Bot access detected for ${trackingId} - skipping event logging`
      );
      console.log(`   UserAgent: ${userAgent}`);
      console.log(`   Referer: ${referer}`);
      return;
    }
  }

  const senderAccess = senderAccessTimes.get(trackingId);
  const timeSinceSender = timestamp - senderAccess;

  console.log(`🔍 DEBUG - timeSinceSender: ${timeSinceSender}ms`);

  // Only log if this appears to be a genuine receiver open
  const isLikelyReceiver =
    isRealBrowser &&
    !isSenderAccess &&
    timeSinceSender > 5000 && // At least 5 seconds since first access
    !isBot;

  if (!receiverEvents.has(trackingId)) {
    receiverEvents.set(trackingId, []);
  }

  const alreadyLogged = receiverEvents.get(trackingId).length > 0;

  if (!alreadyLogged && isLikelyReceiver) {
    receiverEvents.get(trackingId).push({
      timestamp,
      userAgent,
      ip,
      referer,
      type: "receiver_open",
      timeSinceSender,
      confidence: calculateConfidence(userAgent, referer, timeSinceSender),
      isGoogleProxy:
        userAgent.includes("GoogleImageProxy") ||
        userAgent.includes("ggpht.com"),
    });

    console.log(`✅ RECEIVER OPEN recorded for ${trackingId}`);
    console.log(`   Delay since sender: ${timeSinceSender}ms`);
    console.log(`   UserAgent: ${userAgent}`);
    console.log(`   Referer: ${referer}`);
    console.log(
      `   Google Proxy: ${
        userAgent.includes("GoogleImageProxy") ||
        userAgent.includes("ggpht.com")
      }`
    );
  } else {
    const reason = !isRealBrowser
      ? "not real browser"
      : isSenderAccess
      ? "sender access pattern"
      : timeSinceSender <= 5000
      ? "too soon after sender"
      : alreadyLogged
      ? "already logged"
      : "unknown";

    console.log(`ℹ️ Access skipped for ${trackingId} - Reason: ${reason}`);
    console.log(
      `   timeSinceSender: ${timeSinceSender}ms, isRealBrowser: ${isRealBrowser}`
    );
  }
}

// Helper function to calculate confidence score
function calculateConfidence(userAgent, referer, timeSinceSender) {
  let confidence = 0;

  // Google Image Proxy is highly reliable
  if (
    userAgent.includes("GoogleImageProxy") ||
    userAgent.includes("ggpht.com")
  ) {
    confidence += 40;
  }

  // Real browser increases confidence
  if (
    userAgent.includes("Chrome") ||
    userAgent.includes("Firefox") ||
    userAgent.includes("Safari")
  ) {
    confidence += 30;
  }

  // Gmail inbox/email view increases confidence
  if (
    referer.includes("mail.google.com") &&
    !referer.includes("compose") &&
    !referer.includes("sent")
  ) {
    confidence += 25;
  }

  // Time delay increases confidence
  if (timeSinceSender > 300000) confidence += 25; // 5+ minutes
  else if (timeSinceSender > 60000) confidence += 20; // 1+ minute
  else if (timeSinceSender > 30000) confidence += 15; // 30+ seconds
  else if (timeSinceSender > 5000) confidence += 10; // 5+ seconds

  // Mobile user agents (often receivers)
  if (
    userAgent.includes("Mobile") ||
    userAgent.includes("iPhone") ||
    userAgent.includes("Android")
  ) {
    confidence += 10;
  }

  return Math.min(confidence, 100);
}

// Serve tracking pixel (unchanged)
app.get("/track/:trackingId", (req, res) => {
  const { trackingId } = req.params;

  logTrackingData(trackingId, req);

  const pixel = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x04, 0x01, 0x00, 0x3b,
  ]);

  res.set({
    "Content-Type": "image/gif",
    "Content-Length": pixel.length,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  res.send(pixel);
});

// Updated API to get tracking status - now only returns receiver events
app.get("/api/tracking/:trackingId", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  const { trackingId } = req.params;
  const events = receiverEvents.get(trackingId) || [];

  console.log(`📊 API request for tracking ID: ${trackingId}`);
  console.log(`📊 Found ${events.length} receiver events`);

  const data = {
    trackingId,
    opened: events.length > 0,
    openCount: events.length,
    events,
    receiverOnly: true, // Flag to indicate this only tracks receiver opens
  };

  res.set({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });

  res.json(data);
});

// Health check endpoint (unchanged)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.options("/api/tracking/:trackingId", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.sendStatus(200);
});

app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Tracking server running on http://localhost:${PORT}`);
  console.log(`📊 Track endpoint: http://localhost:${PORT}/track/{trackingId}`);
  console.log(
    `🎯 Enhanced sender/receiver detection with Google Image Proxy support enabled`
  );
});
