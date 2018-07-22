
/**
 * request.js
 *
 * Request class contains server only options
 *
 * All spec algorithm step numbers are based on https://fetch.spec.whatwg.org/commit-snapshots/ae716822cb3a61843226cd090eefc6589446c1d2/.
 */

import Headers, { exportNodeCompatibleHeaders } from './headers.js';
import Body, { clone, extractContentType, getTotalBytes } from './body';

const { format: format_url, parse: parse_url } = require('url');
const { AbortController, AbortSignal } = require('abort-controller');

const INTERNALS = Symbol('Request internals');

/**
 * Check if a value is an instance of Request.
 *
 * @param   Mixed   input
 * @return  Boolean
 */
function isRequest(input) {
	return (
		typeof input === 'object' &&
		typeof input[INTERNALS] === 'object'
	);
}

let isAbortSignal;
if (typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol") {
	isAbortSignal = function(input) { return input.toString() === "[object AbortSignal]" };
}
else {
	isAbortSignal = function(input) {
		return (
			typeof input === 'object' &&
			input instanceof AbortSignal
		);
	}
}

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
export default class Request {
	constructor(input, init = {}) {
		let parsedURL;
		let signal;

		// normalize input
		if (!isRequest(input)) {
			if (input && input.href) {
				// in order to support Node.js' Url objects; though WHATWG's URL objects
				// will fall into this branch also (since their `toString()` will return
				// `href` property anyway)
				parsedURL = parse_url(input.href);
			} else {
				// coerce input to a string before attempting to parse
				parsedURL = parse_url(`${input}`);
			}
			input = {};
		} else {
			parsedURL = parse_url(input.url);
			signal = input[INTERNALS].signal;
		}

		if (init.signal !== undefined) {
			if (init.signal !== null && !isAbortSignal(init.signal)) {
				throw new TypeError('Provided signal must be an AbortSignal object');
			}
			signal = init.signal === null ? undefined : init.signal;
		}

		let method = init.method || input.method || 'GET';
		method = method.toUpperCase();

		if ((init.body != null || isRequest(input) && input.body !== null) &&
			(method === 'GET' || method === 'HEAD')) {
			throw new TypeError('Request with GET/HEAD method cannot have body');
		}

		let inputBody = init.body != null ?
			init.body :
			isRequest(input) && input.body !== null ?
				clone(input) :
				null;

		Body.call(this, inputBody, {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		const headers = new Headers(init.headers || input.headers || {});

		if (init.body != null) {
			const contentType = extractContentType(this);
			if (contentType !== null && !headers.has('Content-Type')) {
				headers.append('Content-Type', contentType);
			}
		}

		let onSignalAbort = undefined;
		const abortController = new AbortController();
		if (signal !== undefined) {
			if (signal.aborted) {
				abortController.abort();
			} else {
				onSignalAbort = () => {
					abortController.abort();
				};
				signal.addEventListener('abort', onSignalAbort);
			}
		}

		this[INTERNALS] = {
			method,
			redirect: init.redirect || input.redirect || 'follow',
			headers,
			parsedURL,
			signal: abortController.signal,
			onSignalAbort
		};

		// node-fetch-only options
		this.follow = init.follow !== undefined ?
			init.follow : input.follow !== undefined ?
				input.follow : 20;
		this.compress = init.compress !== undefined ?
			init.compress : input.compress !== undefined ?
				input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;
	}

	get method() {
		return this[INTERNALS].method;
	}

	get url() {
		return format_url(this[INTERNALS].parsedURL);
	}

	get headers() {
		return this[INTERNALS].headers;
	}

	get redirect() {
		return this[INTERNALS].redirect;
	}

	get signal() {
		return this[INTERNALS].signal;
	}

	/**
	 * Clone this request
	 *
	 * @return  Request
	 */
	clone() {
		return new Request(this);
	}
}

Body.mixIn(Request.prototype);

Object.defineProperty(Request.prototype, Symbol.toStringTag, {
	value: 'Request',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Request.prototype, {
	method: { enumerable: true },
	url: { enumerable: true },
	headers: { enumerable: true },
	redirect: { enumerable: true },
	clone: { enumerable: true }
});

/**
 * Indicates whether Request instance is listening for abort signal.
 *
 * @param   Request      A Request instance
 * @return  boolean
 */
export function isListeningForAbortSignal(request) {
	const signal = request[INTERNALS].signal;
	return signal !== undefined
		&& signal.aborted !== true
		&& request[INTERNALS].onSignalAbort !== undefined;
}

/**
 * Removes the callback attached to a Request's signal "abort" event.
 *
 * @param   Request      A Request instance
 * @return  boolean      Indicates whether callback has been removed
 */
export function removeAbortSignalCallback(request) {
	if (request[INTERNALS].onSignalAbort !== undefined) {
		const callback = request[INTERNALS].onSignalAbort;
		request[INTERNALS].onSignalAbort = undefined;
		return request.signal.removeEventListener('abort', callback);
	}
	return false;
}

/**
 * Get the AbortSignal object belonging to a Request.
 *
 * @param   Request      A Request instance
 * @return  AbortSignal  request's signal
 */
export function getAbortSignal(request) {
	return request[INTERNALS].signal;
}

/**
 * Convert a Request to Node.js http request options.
 *
 * @param   Request  A Request instance
 * @return  Object   The options object to be passed to http.request
 */
export function getNodeRequestOptions(request) {
	const parsedURL = request[INTERNALS].parsedURL;
	const headers = new Headers(request[INTERNALS].headers);

	// fetch step 1.3
	if (!headers.has('Accept')) {
		headers.set('Accept', '*/*');
	}

	// Basic fetch
	if (!parsedURL.protocol || !parsedURL.hostname) {
		throw new TypeError('Only absolute URLs are supported');
	}

	if (!/^https?:$/.test(parsedURL.protocol)) {
		throw new TypeError('Only HTTP(S) protocols are supported');
	}

	// HTTP-network-or-cache fetch steps 2.4-2.7
	let contentLengthValue = null;
	if (request.body == null && /^(POST|PUT)$/i.test(request.method)) {
		contentLengthValue = '0';
	}
	if (request.body != null) {
		const totalBytes = getTotalBytes(request);
		if (typeof totalBytes === 'number') {
			contentLengthValue = String(totalBytes);
		}
	}
	if (contentLengthValue) {
		headers.set('Content-Length', contentLengthValue);
	}

	// HTTP-network-or-cache fetch step 2.11
	if (!headers.has('User-Agent')) {
		headers.set('User-Agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
	}

	// HTTP-network-or-cache fetch step 2.15
	if (request.compress) {
		headers.set('Accept-Encoding', 'gzip,deflate');
	}
	if (!headers.has('Connection') && !request.agent) {
		headers.set('Connection', 'close');
	}

	// HTTP-network fetch step 4.2
	// chunked encoding is handled by Node.js

	return Object.assign({}, parsedURL, {
		method: request.method,
		headers: exportNodeCompatibleHeaders(headers),
		agent: request.agent
	});
}
