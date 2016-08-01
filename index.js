
/**
 * index.js
 *
 * a request API compatible with window.fetch
 */

var parse_url = require('url').parse;
var resolve_url = require('url').resolve;
var http = require('http');
var https = require('https');
var zlib = require('zlib');
var stream = require('stream');

var Body = require('./lib/body');
var Response = require('./lib/response');
var Headers = require('./lib/headers');
var Request = require('./lib/request');
var FetchError = require('./lib/fetch-error');
var webStreams = require('node-web-streams');

// commonjs
module.exports = Fetch;
// es6 default export compatibility
module.exports.default = module.exports;

/**
 * Fetch class
 *
 * @param   Mixed    url   Absolute url or Request instance
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
function Fetch(url, opts) {

	// allow call as function
	if (!(this instanceof Fetch))
		return new Fetch(url, opts);

	// allow custom promise
	if (!Fetch.Promise) {
		throw new Error('native promise missing, set Fetch.Promise to your favorite alternative');
	}

	Body.Promise = Fetch.Promise;

	var self = this;

	// wrap http.request into fetch
	return new Fetch.Promise(function(resolve, reject) {
		// build request object
		const request = new Request(url, opts);

		if (!request.protocol || !request.hostname) {
			throw new Error('only absolute urls are supported');
		}

		if (request.protocol !== 'http:' && request.protocol !== 'https:') {
			throw new Error('only http(s) protocols are supported');
		}

		var send;
		if (request.protocol === 'https:') {
			send = https.request;
		} else {
			send = http.request;
		}

		// normalize headers
		var headers = new Headers(request.headers);

		if (request.compress) {
			headers.set('accept-encoding', 'gzip,deflate');
		}

		if (!headers.has('user-agent')) {
			headers.set('user-agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
		}

		if (!headers.has('connection') && !request.agent) {
			headers.set('connection', 'close');
		}

		if (!headers.has('accept')) {
			headers.set('accept', '*/*');
		}

		// detect form data input from form-data module, this hack avoid the need to pass multipart header manually
		if (!headers.has('content-type') && request._rawBody
				&& typeof request._rawBody.getBoundary === 'function') {
			headers.set('content-type', 'multipart/form-data; boundary=' + request.body.getBoundary());
		}

		// bring node-fetch closer to browser behavior by setting content-length automatically
		if (!headers.has('content-length') && /post|put|patch|delete/i.test(request.method)) {
			if (typeof request._rawBody === 'string') {
	            request._rawBody = new Buffer(request._rawBody);
			}
			if (Buffer.isBuffer(request._rawBody)) {
				headers.set('content-length', request._rawBody.length);
			// detect form data input from form-data module, this hack avoid the need to add content-length header manually
			} else if (request._rawBody
					&& typeof request._rawBody.getLengthSync === 'function'
					&& request._rawBody._lengthRetrievers.length == 0) {
				headers.set('content-length', request._rawBody.getLengthSync().toString());
			// this is only necessary for older nodejs releases (before iojs merge)
			} else if (request._rawBody === undefined || request._rawBody === null) {
				headers.set('content-length', '0');
			}
		}

		request.headers = headers.raw();

		// http.request only support string as host header, this hack make custom host header possible
		if (request.headers.host) {
			request.headers.host = request.headers.host[0];
		}

		// send request
		var req = send(request);
		var reqTimeout;

		if (request.timeout) {
			req.once('socket', function(socket) {
				reqTimeout = setTimeout(function() {
					req.abort();
					reject(new FetchError('network timeout at: ' + request.url, 'request-timeout'));
				}, request.timeout);
			});
		}

		req.on('error', function(err) {
			clearTimeout(reqTimeout);
			reject(new FetchError('request to ' + request.url + ' failed, reason: ' + err.message, 'system', err));
		});

		req.on('response', function(res) {
			clearTimeout(reqTimeout);

			// handle redirect
			if (self.isRedirect(res.statusCode) && request.redirect !== 'manual') {
				if (request.redirect === 'error') {
					reject(new FetchError('redirect mode is set to error: ' + request.url, 'no-redirect'));
					return;
				}

				if (request.counter >= request.follow) {
					reject(new FetchError('maximum redirect reached at: ' + request.url, 'max-redirect'));
					return;
				}

				if (!res.headers.location) {
					reject(new FetchError('redirect location header missing at: ' + request.url, 'invalid-redirect'));
					return;
				}

				// per fetch spec, for POST request with 301/302 response, or any request with 303 response, use GET when following redirect
				if (res.statusCode === 303
					|| ((res.statusCode === 301 || res.statusCode === 302) && request.method === 'POST'))
				{
					request.method = 'GET';
					request.body = undefined;
					delete request.headers['content-length'];
				}

				request.counter++;

				resolve(Fetch(resolve_url(request.url, res.headers.location), request));
				return;
			}

			// handle compression
			var body = res;
			var headers = new Headers(res.headers);

			if (request.compress && headers.has('content-encoding')) {
				var name = headers.get('content-encoding');

				// no need to pipe no content and not modified response body
				if (res.statusCode !== 204 && res.statusCode !== 304) {
					if (name == 'gzip' || name == 'x-gzip') {
						body = body.pipe(zlib.createGunzip());
					} else if (name == 'deflate' || name == 'x-deflate') {
						body = body.pipe(zlib.createInflate());
					}
				}
			}

	        // Convert to ReadableStream
	        body = webStreams.toWebReadableStream(body);

			// normalize location header for manual redirect mode
			if (request.redirect === 'manual' && headers.has('location')) {
				headers.set('location', resolve_url(request.url, headers.get('location')));
			}

			// response object
			var output = new Response(body, {
				url: request.url
				, status: res.statusCode
				, statusText: res.statusMessage
				, headers: headers
				, size: request.size
				, timeout: request.timeout
			});

			resolve(output);
		});

		// Request body handling
		if (request._rawBody !== undefined && request._rawBody !== null) {
	        if (Buffer.isBuffer(request._rawBody)) {
				// Fast path for simple buffers. Avoid stream wrapper &
				// chunked encoding.
	            return req.end(request._rawBody);
	        } else if (request._rawBody.pipe) {
	            // Node stream (likely FormData).
	            return request._rawBody.pipe(req);
	        } else {
	            // Standard ReadableStream
	            const nodeBody = webStreams.toNodeReadable(request.body);
	            return nodeBody.pipe(req);
	        }
	    }
		req.end();
	});

};

/**
 * Redirect code matching
 *
 * @param   Number   code  Status code
 * @return  Boolean
 */
Fetch.prototype.isRedirect = function(code) {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
}

// expose Promise
Fetch.Promise = global.Promise;
Fetch.Response = Response;
Fetch.Headers = Headers;
Fetch.Request = Request;
