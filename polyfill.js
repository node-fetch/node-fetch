// commonjs
module.exports = polyfill;
// es6 default export compatibility
module.exports.default = module.exports;

// this is exported as a function so it can be ran multiple times for testing
// while going around Nodejs module caching
function polyfill() {

	if (global.fetch !== undefined ||
		global.Request !== undefined ||
		global.Headers !== undefined ||
		global.Response !== undefined) {

		throw new Error('a fetch (or Request, Headers, Response) object is already defined globally');
	}

	var Fetch = require('./index.js');
	global.fetch = Fetch;
	global.Request = Fetch.Request;
	global.Headers = Fetch.Headers;
	global.Response = Fetch.Response;
}

// polyfill automatically
polyfill();
