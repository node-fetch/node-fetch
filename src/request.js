
/**
 * request.js
 *
 * Request class contains server only options
 */

import { parse as parse_url } from 'url';
import Headers from './headers.js';
import Body, { clone } from './body';

/**
 * Request class
 *
 * @param   Mixed   input  Url or Request instance
 * @param   Object  init   Custom options
 * @return  Void
 */
export default class Request extends Body {
	constructor(input, init = {}) {
		let url, url_parsed;

		// normalize input
		if (!(input instanceof Request)) {
			url = input;
			url_parsed = parse_url(url);
			input = {};
		} else {
			url = input.url;
			url_parsed = parse_url(url);
		}

		super(init.body || clone(input), {
			timeout: init.timeout || input.timeout || 0,
			size: init.size || input.size || 0
		});

		// fetch spec options
		this.method = init.method || input.method || 'GET';
		this.redirect = init.redirect || input.redirect || 'follow';
		this.headers = new Headers(init.headers || input.headers || {});
		this.url = url;

		// server only options
		this.follow = init.follow !== undefined ?
			init.follow : input.follow !== undefined ?
			input.follow : 20;
		this.compress = init.compress !== undefined ?
			init.compress : input.compress !== undefined ?
			input.compress : true;
		this.counter = init.counter || input.counter || 0;
		this.agent = init.agent || input.agent;

		// server request options
		this.protocol = url_parsed.protocol;
		this.hostname = url_parsed.hostname;
		this.port = url_parsed.port;
		this.path = url_parsed.path;
		this.auth = url_parsed.auth;
	}

	/**
	 * Clone this request
	 *
	 * @return  Request
	 */
	clone() {
		return new Request(this);
	}

	/**
	 * Tag used by `Object.prototype.toString()`.
	 */
	get [Symbol.toStringTag]() {
		return 'Request';
	}
}
