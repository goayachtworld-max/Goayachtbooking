import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  // console.log("I'm in")
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      const err = new Error("No token provided");
      err.status = 401;
      return next(err);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    error.status = 401;
    next(error);  // Pass to global handler
  }

  // console.log("Moving to next")
};


// ✅ Only Admin Middleware
export const onlyAdmin = (req, res, next) => {
  if (req.user?.type?.toLowerCase() !== "admin") {
    const err = new Error("Only Admin can perform this action");
    err.status = 403; // Attach HTTP status
    return next(err);  // Pass to global handler
  }
  next();
};

