/**
 * HS256 JWTs via `jose` (Web Crypto / modern Node; no legacy buffer shim).
 */
const { SignJWT, jwtVerify } = require("jose");
const { jwtSecret } = require("../config");

function secretKey() {
  return new TextEncoder().encode(jwtSecret);
}

async function signUserToken(user) {
  const payload = {
    id: String(user._id),
    username: user.username,
    role: user.role,
  };

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey());
}

async function verifyUserToken(token) {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });

  return {
    id: payload.id,
    username: payload.username,
    role: payload.role,
  };
}

module.exports = { signUserToken, verifyUserToken };