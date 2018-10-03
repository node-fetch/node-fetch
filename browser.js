"use strict";

var context = typeof self === "undefined" ? typeof global === "undefined" ? this : global : self;

module.exports = exports = context.fetch;

// Needed for TypeScript and Webpack.
exports.default = context.fetch.bind(context);

exports.Headers = context.Headers;
exports.Request = context.Request;
exports.Response = context.Response;
