const { verifyUserToken } = require("../utils/jwtTokens");

const auth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const token = header.split(" ")[1];
    req.user = await verifyUserToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

const superAdmin = (req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required." });
  }
  next();
};

module.exports = { auth, superAdmin };
