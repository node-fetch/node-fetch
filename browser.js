"use strict";

module.exports = exports = this.fetch;

// Needed for TypeScript and Webpack.
exports.default = this.fetch.bind(this);

exports.Headers = this.Headers;
exports.Request = this.Request;
exports.Response = this.Response;
