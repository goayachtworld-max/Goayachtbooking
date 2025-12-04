// Global Error Handler (must be after all routes)
export const globalErrorHandler = ((err, req, res, next) => {
  console.error("❌ Server Error:", err);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join(", "),
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} "${err.keyValue[field]}" already exists`,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  if (err?.status) {
    return res.status(err.status).json({
      success: false,
      message: err.message
    });
  }

  try {
    const parsed = JSON.parse(err.message);
    if (Array.isArray(parsed)) {
      const messages = parsed.map(e => e.message || "Validation error");
      return res.status(400).json({
        success: false,
        message: messages.join(", ")
      });
    }
  } catch {}

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});