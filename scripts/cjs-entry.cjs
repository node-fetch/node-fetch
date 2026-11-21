'use strict';

/**
 * Entry point for the CommonJS build (bundled to lib/index.cjs by
 * scripts/build.js).
 *
 * node-fetch v2 exposed the fetch function itself as `module.exports`, with
 * the named exports attached to it and a `.default` alias for ESM interop.
 * Keep that exact shape so existing CommonJS consumers keep working:
 *
 *   const fetch = require('node-fetch');      // callable, like v2
 *   fetch(url);
 *   const {Headers} = require('node-fetch');  // named exports
 *   import fetch from 'node-fetch';           // interop resolves to `.default`
 *
 * When bundled, `require('../src/index.js')` below resolves to the ESM
 * namespace object of src/index.js, i.e. `{default: fetch, Headers, ...}`.
 */

const nodeFetch = require('../src/index.js');

const fetch = nodeFetch.default;

module.exports = fetch;
module.exports.default = fetch;
module.exports.fetch = fetch;

// Attach every named export (Headers, Request, Response, FetchError,
// AbortError, isRedirect, FormData, Blob, File, fileFrom, ...) to the
// function object, like node-fetch v2 did.
for (const key of Object.keys(nodeFetch)) {
	if (key !== 'default' && key !== '__esModule' && !(key in module.exports)) {
		module.exports[key] = nodeFetch[key];
	}
}
