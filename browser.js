"use strict";

function getSelf() {
  if (typeof self !== 'undefined') return self;

  if (typeof this !== 'undefined') return this;
  if (typeof global !== 'undefined') return global;
  if (typeof window !== 'undefined') return window;
  throw new Error('Failed to access global variable "self".');
}

;(function(self) {
module.exports = exports = self.fetch;

// Needed for TypeScript and Webpack.
exports.default = self.fetch.bind(self);

exports.Headers = self.Headers;
exports.Request = self.Request;
exports.Response = self.Response;
})(getSelf());
