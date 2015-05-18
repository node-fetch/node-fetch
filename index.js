/**
 * index.js
 *
 * a request API compatible with window.fetch
 */

var Request = require('./lib/request');
var Response = require('./lib/response');
var Headers = require('./lib/headers');

module.exports = fetch;

/**
 * fetch function
 *
 * @param   String|Request   input
 * @param   Object   		 init
 * @return  Promise
 */
function fetch(input, init) {
	// allow custom promise
	if (!fetch.Promise) {
		throw new Error('native promise missing, set fetch.Promise to your favorite alternative');
	}
	Request.Promise = Response.Promise = fetch.Promise;

	if (!(input instanceof Request)) {
		input = new Request(input, init);
	}

	return input.execute();
}

// expose Promise
fetch.Promise = global.Promise;

fetch.Request = Request;
fetch.Response = Response;
fetch.Headers = Headers;
