/**
 * browser.js
 *
 * exports window.fetch when bundled by browserify/webpack
 */

module.exports = window.fetch;
module.exports.default = module.exports;
