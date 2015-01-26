
/**
 * index.js
 *
 * export fetch
 */

var parse = require('url').parse;
var resolve = require('url').resolve;
var http = require('http');
var https = require('https');
var zlib = require('zlib');
var stream = require('stream');

module.exports = Fetch;

/**
 * Create an instance of Decent
 *
 * @param   String   url   Absolute url
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
function Fetch(url, opts) {

	if (!(this instanceof Fetch))
		return new Fetch(url, opts);

	if (!Fetch.Promise) {
		throw new Error('native promise missing, set Fetch.Promise to your favorite alternative');
	}

	var self = this;

	return new Fetch.Promise(function(resolve, reject) {
		opts = opts || {};

		var uri = parse(url);

		if (!uri.protocol || !uri.hostname) {
			reject(Error('only absolute urls are supported'));
			return;
		}

		if (uri.protocol !== 'http:' && uri.protocol !== 'https:') {
			reject(Error('only http(s) protocols are supported'));
			return;
		}

		// TODO: detect type and decode data

		var request;
		if (uri.protocol === 'https:') {
			request = https.request;
		} else {
			request = http.request;
		}

		// avoid side-effect on input
		var options = {
			hostname: uri.hostname
			, port: uri.port
			, method: opts.method
			, path: uri.path
			, headers: opts.headers || {}
			, auth: uri.auth
			, follow: opts.follow || 20
			, counter: opts.counter || 0
			, agent: opts.agent
			, body: opts.body
			, timeout: opts.timeout
		};

		var req = request(options);

		req.on('error', function(err) {
			reject(new Error('request to ' + uri.href + ' failed, reason: ' + err.message));
		});

		req.on('response', function(res) {
			if (self.isRedirect(res.statusCode)) {
				if (options.counter >= options.follow) {
					reject(Error('maximum redirect reached at: ' + uri.href));
				}

				if (!res.headers.location) {
					reject(Error('redirect location header missing at: ' + uri.href));
				}

				return Fetch(resolve(uri.href, res.headers.location), options);
			}

			var output = {
				status: res.statusCode
				, headers: res.headers
				, body: res.pipe(new stream.PassThrough())
				, url: uri.href
			};

			resolve(output);
		});

		if (typeof options.body === 'string') {
			req.write(options.body);
			req.end();
		} else if (options.body instanceof stream.Readable) {
			options.body.pipe(req);
		} else {
			req.end();
		}

		if (options.timeout) {
			setTimeout(function() {
				req.abort();
				reject(new Error('network timeout at: ' + uri.href));
			}, options.timeout);
		}
	});

};

/**
 * Create an instance of Decent
 *
 * @param   Number   code  Status code
 * @return  Boolean
 */
Fetch.prototype.isRedirect = function(code) {
	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
}

// expose Promise
Fetch.Promise = global.Promise;
