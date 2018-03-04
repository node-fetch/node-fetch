
/**
 * index.js
 *
 * a request API compatible with window.fetch
 */

import Body, { writeToStream } from './body';
import Response from './response';
import Headers, { createHeadersLenient } from './headers';
import Request, { getNodeRequestOptions } from './request';
import FetchError from './fetch-error';

const http = require('http');
const https = require('https');
const { PassThrough } = require('stream');
const { resolve: resolve_url } = require('url');
const zlib = require('zlib');

/**
 * Fetch function
 *
 * @param   Mixed    url   Absolute url or Request instance
 * @param   Object   opts  Fetch options
 * @return  Promise
 */
export default function fetch(url, opts) {

	// allow custom promise
	if (!fetch.Promise) {
		throw new Error('native promise missing, set fetch.Promise to your favorite alternative');
	}

	Body.Promise = fetch.Promise;

	// wrap http.request into fetch
	return new fetch.Promise((resolve, reject) => {
		// build request object
		const request = new Request(url, opts);
		const options = getNodeRequestOptions(request);

		const send = (options.protocol === 'https:' ? https : http).request;

		// http.request only support string as host header, this hack make custom host header possible
		if (options.headers.host) {
			options.headers.host = options.headers.host[0];
		}

		// send request
		const req = send(options);
		let reqTimeout;

		if (request.timeout) {
			req.once('socket', socket => {
				reqTimeout = setTimeout(() => {
					req.abort();
					reject(new FetchError(`network timeout at: ${request.url}`, 'request-timeout'));
				}, request.timeout);
			});
		}

		req.on('error', err => {
			clearTimeout(reqTimeout);
			reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, 'system', err));
		});

		req.on('response', res => {
			clearTimeout(reqTimeout);

			// handle redirect
			if (fetch.isRedirect(res.statusCode) && request.redirect !== 'manual') {
				if (request.redirect === 'error') {
					reject(new FetchError(`redirect mode is set to error: ${request.url}`, 'no-redirect'));
					return;
				}

				if (request.counter >= request.follow) {
					reject(new FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
					return;
				}

				if (!res.headers.location) {
					reject(new FetchError(`redirect location header missing at: ${request.url}`, 'invalid-redirect'));
					return;
				}

				// Create a new Request object.
				const requestOpts = {
					headers: new Headers(request.headers),
					follow: request.follow,
					counter: request.counter + 1,
					agent: request.agent,
					compress: request.compress,
					method: request.method
				};

				// per fetch spec, for POST request with 301/302 response, or any request with 303 response, use GET when following redirect
				if (res.statusCode === 303
					|| ((res.statusCode === 301 || res.statusCode === 302) && request.method === 'POST'))
				{
					requestOpts.method = 'GET';
					requestOpts.headers.delete('content-length');
				}

				resolve(fetch(new Request(resolve_url(request.url, res.headers.location), requestOpts)));
				return;
			}

			const headers = createHeadersLenient(res.headers);
			// normalize location header for manual redirect mode
			if (request.redirect === 'manual' && headers.has('Location')) {
				headers.set('Location', resolve_url(request.url, headers.get('Location')));
			}

			// prepare response
			let body = res.pipe(new PassThrough());
			const response_options = {
				url: request.url
				, status: res.statusCode
				, statusText: res.statusMessage
				, headers: headers
				, size: request.size
				, timeout: request.timeout
			};

			// HTTP-network fetch step 16.1.2
			const codings = headers.get('Content-Encoding');

			// HTTP-network fetch step 16.1.3: handle content codings

			// in following scenarios we ignore compression support
			// 1. compression support is disabled
			// 2. HEAD request
			// 3. no Content-Encoding header
			// 4. no content response (204)
			// 5. content not modified response (304)
			if (!request.compress || request.method === 'HEAD' || codings === null || res.statusCode === 204 || res.statusCode === 304) {
				resolve(new Response(body, response_options));
				return;
			}

			// For Node v6+
			// Be less strict when decoding compressed responses, since sometimes
			// servers send slightly invalid responses that are still accepted
			// by common browsers.
			// Always using Z_SYNC_FLUSH is what cURL does.
			const zlibOptions = {
				flush: zlib.Z_SYNC_FLUSH,
				finishFlush: zlib.Z_SYNC_FLUSH
			};

			// for gzip
			if (codings == 'gzip' || codings == 'x-gzip') {
				body = body.pipe(zlib.createGunzip(zlibOptions));
				resolve(new Response(body, response_options));
				return;
			}

			// for deflate
			if (codings == 'deflate' || codings == 'x-deflate') {
				// handle the infamous raw deflate response from old servers
				// a hack for old IIS and Apache servers
				const raw = res.pipe(new PassThrough());
				raw.once('data', chunk => {
					// see http://stackoverflow.com/questions/37519828
					if ((chunk[0] & 0x0F) === 0x08) {
						body = body.pipe(zlib.createInflate());
					} else {
						body = body.pipe(zlib.createInflateRaw());
					}
					resolve(new Response(body, response_options));
				});
				return;
			}

			// otherwise, use response as-is
			resolve(new Response(body, response_options));
		});

		writeToStream(req, request);
	});

};

/**
 * Redirect code matching
 *
 * @param   Number   code  Status code
 * @return  Boolean
 */
fetch.isRedirect = code => code === 301 || code === 302 || code === 303 || code === 307 || code === 308;

// Needed for TypeScript.
fetch.default = fetch;

// expose Promise
fetch.Promise = global.Promise;
export {
	Headers,
	Request,
	Response,
	FetchError
};
