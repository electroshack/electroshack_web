const { createProxyMiddleware } = require("http-proxy-middleware");

/** CRA → backend. Port 5000 is AirPlay on this Mac; local API is 5050. */
module.exports = function setupProxy(app) {
  const target = process.env.BACKEND_URL || "http://localhost:5050";
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
