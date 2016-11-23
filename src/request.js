
/**
 * request.js
 *
 * Request class contains server only options
 */

import { format as format_url, parse as parse_url } from 'url';
import Headers from './headers.js';
import Body, { clone, extractContentType, getTotalBytes } from './body';

const PARSED_URL = Symbol('url');

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
export default class Request extends Body {
	constructor(input, init = {}) {
		let parsedURL;

		// normalize input
		if (!(input instanceof Request)) {
			if (input && input.href) {
				// in order to support Node.js' Url objects; though WHATWG's URL objects
				// will fall into this branch also (since their `toString()` will return
				// `href` property anyway)
				parsedURL = parse_url(input.href);
			} else {
				// coerce input to a string before attempting to parse
				parsedURL = parse_url(input + '');
			}
			input = {};
		} else {
			parsedURL = parse_url(input.url);
		}

		super(init.body || clone(input), {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		// fetch spec options
		this.method = init.method || input.method || 'GET';
		this.redirect = init.redirect || input.redirect || 'follow';
		this.headers = new Headers(init.headers || input.headers || {});

		if (init.body) {
			const contentType = extractContentType(this);
			if (contentType && !this.headers.has('Content-Type')) {
				this.headers.append('Content-Type', contentType);
			}
		}

		// server only options
		this.follow = init.follow !== undefined ?
			init.follow : input.follow !== undefined ?
			input.follow : 20;
		this.compress = init.compress !== undefined ?
			init.compress : input.compress !== undefined ?
			input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;

		this[PARSED_URL] = parsedURL;

		Object.defineProperty(this, Symbol.toStringTag, {
			value: 'Request',
			writable: false,
			enumerable: false,
			configurable: true
		});
	}

	get url() {
		return format_url(this[PARSED_URL]);
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

Object.defineProperty(Request.prototype, Symbol.toStringTag, {
	value: 'RequestPrototype',
	writable: false,
	enumerable: false,
	configurable: true
});

function normalizeHeaders(request) {
	const headers = new Headers(request.headers);

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

	if (!headers.has('content-length') && /post|put|patch|delete/i.test(request.method)) {
		const totalBytes = getTotalBytes(request);
		if (typeof totalBytes === 'number') {
			headers.set('content-length', totalBytes);
		}
	}

	return headers;
}

export function getNodeRequestOptions(request) {
	return Object.assign({}, request[PARSED_URL], {
		method: request.method,
		headers: normalizeHeaders(request).raw(),
		agent: request.agent
	});
}
