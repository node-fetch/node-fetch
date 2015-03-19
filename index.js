
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

var Response = require('./lib/response');
var Headers = require('./lib/headers');

module.exports = Fetch;

/**
 * Fetch class
 *
 * @param   String   url   Absolute url
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

	Response.Promise = Fetch.Promise;

	var self = this;

	// wrap http.request into fetch
	return new Fetch.Promise(function(resolve, reject) {
		var uri = parse_url(url);

		if (!uri.protocol || !uri.hostname) {
			reject(new Error('only absolute urls are supported'));
			return;
		}

		if (uri.protocol !== 'http:' && uri.protocol !== 'https:') {
			reject(new Error('only http(s) protocols are supported'));
			return;
		}

		var request;
		if (uri.protocol === 'https:') {
			request = https.request;
		} else {
			request = http.request;
		}

		opts = opts || {};

		// avoid side-effect on input options
		var options = {
			hostname: uri.hostname
			, port: uri.port
			, path: uri.path
			, auth: uri.auth
			, method: opts.method || 'GET'
			, headers: opts.headers || {}
			, follow: opts.follow !== undefined ? opts.follow : 20
			, counter: opts.counter || 0
			, timeout: opts.timeout || 0
			, compress: opts.compress !== false
			, size: opts.size || 0
			, body: opts.body
			, agent: opts.agent
		};

		// normalize headers
		var headers = new Headers(options.headers);

		if (options.compress) {
			headers.set('accept-encoding', 'gzip,deflate');
		}

		if (!headers.has('user-agent')) {
			headers.set('user-agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
		}

		if (!headers.has('connection')) {
			headers.set('connection', 'close');
		}

		if (!headers.has('accept')) {
			headers.set('accept', '*/*');
		}

		options.headers = headers.raw();

		// send request
		var req = request(options);

		if (options.timeout) {
			req.once('socket', function(socket) {
				setTimeout(function() {
					req.abort();
					reject(new Error('network timeout at: ' + uri.href));
				}, options.timeout);
			});
		}

		req.on('error', function(err) {
			reject(new Error('request to ' + uri.href + ' failed, reason: ' + err.message));
		});

		req.on('response', function(res) {
			// handle redirect
			if (self.isRedirect(res.statusCode)) {
				if (options.counter >= options.follow) {
					reject(new Error('maximum redirect reached at: ' + uri.href));
					return;
				}

				if (!res.headers.location) {
					reject(new Error('redirect location header missing at: ' + uri.href));
					return;
				}

				options.counter++;

				resolve(Fetch(resolve_url(uri.href, res.headers.location), options));
				return;
			}

			// handle compression
			var body = res.pipe(new stream.PassThrough());
			var headers = new Headers(res.headers);

			if (options.compress && headers.has('content-encoding')) {
				var name = headers.get('content-encoding');

				if (name == 'gzip' || name == 'x-gzip') {
					body = body.pipe(zlib.createGunzip());
				} else if (name == 'deflate' || name == 'x-deflate') {
					body = body.pipe(zlib.createInflate());
				}
			}

			// response object
			var output = new Response(body, {
				url: uri.href
				, status: res.statusCode
				, headers: headers
				, size: options.size
			});

			resolve(output);
		});

		// accept string or readable stream as body
		if (typeof options.body === 'string') {
			req.write(options.body);
			req.end();
		} else if (typeof options.body === 'object' && options.body.pipe) {
			options.body.pipe(req);
		} else {
			req.end();
		}
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
