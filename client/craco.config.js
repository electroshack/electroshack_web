const path = require("path");

// Only resolve source maps for app code. html5-qrcode points source maps at missing paths under node_modules.
module.exports = {
  webpack: {
    configure(webpackConfig) {
      const appSrc = path.resolve(__dirname, "src");
      webpackConfig.module.rules.forEach((rule) => {
        if (
          rule &&
          rule.enforce === "pre" &&
          typeof rule.loader === "string" &&
          rule.loader.includes("source-map-loader")
        ) {
          rule.include = appSrc;
        }
      });
      return webpackConfig;
    },
  },
};