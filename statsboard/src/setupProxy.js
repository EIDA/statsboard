const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://ws.resif.fr',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/eidaws/statistics/1/dataselect'
      }
    })
  );
};
