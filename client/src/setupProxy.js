const { createProxyMiddleware } = require("http-proxy-middleware");

/** CRA proxy. Default 5000; set BACKEND_URL if AirPlay (or anything else) already owns that port. */
module.exports = function setupProxy(app) {
  const target = process.env.BACKEND_URL || "http://localhost:5000";
  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};
