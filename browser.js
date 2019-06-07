"use strict";

(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.returnExports = factory();
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof window !== "undefined"
    ? window
    : global,
  function() {
    var exports = global.fetch;
    // Needed for TypeScript and Webpack.
    exports.default = global.fetch.bind(global);
    exports.Headers = global.Headers;
    exports.Request = global.Request;
    exports.Response = global.Response;
    return exports;
  }
);
