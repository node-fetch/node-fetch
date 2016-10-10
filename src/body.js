
/**
 * body.js
 *
 * Body interface provides common methods for Request and Response
 */

import {convert} from 'encoding';
import bodyStream from 'is-stream';
import {PassThrough} from 'stream';
import FetchError from './fetch-error.js';

const DISTURBED = Symbol('disturbed');
const BYTES = Symbol('bytes');
const RAW = Symbol('raw');
const ABORT = Symbol('abort');
const CONVERT = Symbol('convert');
const DECODE = Symbol('decode');

/**
 * Body class
 *
 * @param   Stream  body  Readable stream
 * @param   Object  opts  Response options
 * @return  Void
 */
export default class Body {
	constructor(body, {
		size = 0,
		timeout = 0
	} = {}) {
		this.body = body;
		this[DISTURBED] = false;
		this.size = size;
		this[BYTES] = 0;
		this.timeout = timeout;
		this[RAW] = [];
		this[ABORT] = false;
	}

	get bodyUsed() {
		return this[DISTURBED];
	}

	/**
	 * Decode response as json
	 *
	 * @return  Promise
	 */
	json() {
		// for 204 No Content response, buffer will be empty, parsing it will throw error
		if (this.status === 204) {
			return Body.Promise.resolve({});
		}

		return this[DECODE]().then(buffer => JSON.parse(buffer.toString()));
	}

	/**
	 * Decode response as text
	 *
	 * @return  Promise
	 */
	text() {
		return this[DECODE]().then(buffer => buffer.toString());
	}

	/**
	 * Decode response as buffer (non-spec api)
	 *
	 * @return  Promise
	 */
	buffer() {
		return this[DECODE]();
	}

	/**
	 * Decode buffers into utf-8 string
	 *
	 * @return  Promise
	 */
	[DECODE]() {
		if (this[DISTURBED]) {
			return Body.Promise.reject(new Error(`body used already for: ${this.url}`));
		}

		this[DISTURBED] = true;
		this[BYTES] = 0;
		this[ABORT] = false;
		this[RAW] = [];

		return new Body.Promise((resolve, reject) => {
			let resTimeout;

			// body is string
			if (typeof this.body === 'string') {
				this[BYTES] = this.body.length;
				this[RAW] = [new Buffer(this.body)];
				return resolve(this[CONVERT]());
			}

			// body is buffer
			if (this.body instanceof Buffer) {
				this[BYTES] = this.body.length;
				this[RAW] = [this.body];
				return resolve(this[CONVERT]());
			}

			// allow timeout on slow response body
			if (this.timeout) {
				resTimeout = setTimeout(() => {
					this[ABORT] = true;
					reject(new FetchError('response timeout at ' + this.url + ' over limit: ' + this.timeout, 'body-timeout'));
				}, this.timeout);
			}

			// handle stream error, such as incorrect content-encoding
			this.body.on('error', err => {
				reject(new FetchError('invalid response body at: ' + this.url + ' reason: ' + err.message, 'system', err));
			});

			// body is stream
			this.body.on('data', chunk => {
				if (this[ABORT] || chunk === null) {
					return;
				}

				if (this.size && this[BYTES] + chunk.length > this.size) {
					this[ABORT] = true;
					reject(new FetchError(`content size at ${this.url} over limit: ${this.size}`, 'max-size'));
					return;
				}

				this[BYTES] += chunk.length;
				this[RAW].push(chunk);
			});

			this.body.on('end', () => {
				if (this[ABORT]) {
					return;
				}

				clearTimeout(resTimeout);
				resolve(this[CONVERT]());
			});
		});
	}

	/**
	 * Detect buffer encoding and convert to target encoding
	 * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
	 *
	 * @param   String  encoding  Target encoding
	 * @return  String
	 */
	[CONVERT](encoding = 'utf-8') {
		const ct = this.headers.get('content-type');
		let charset = 'utf-8';
		let res, str;

		// header
		if (ct) {
			// skip encoding detection altogether if not html/xml/plain text
			if (!/text\/html|text\/plain|\+xml|\/xml/i.test(ct)) {
				return Buffer.concat(this[RAW]);
			}

			res = /charset=([^;]*)/i.exec(ct);
		}

		// no charset in content type, peek at response body for at most 1024 bytes
		if (!res && this[RAW].length > 0) {
			for (let i = 0; i < this[RAW].length; i++) {
				str += this[RAW][i].toString()
				if (str.length > 1024) {
					break;
				}
			}
			str = str.substr(0, 1024);
		}

		// html5
		if (!res && str) {
			res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
		}

		// html4
		if (!res && str) {
			res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);

			if (res) {
				res = /charset=(.*)/i.exec(res.pop());
			}
		}

		// xml
		if (!res && str) {
			res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
		}

		// found charset
		if (res) {
			charset = res.pop();

			// prevent decode issues when sites use incorrect encoding
			// ref: https://hsivonen.fi/encoding-menu/
			if (charset === 'gb2312' || charset === 'gbk') {
				charset = 'gb18030';
			}
		}

		// turn raw buffers into a single utf-8 buffer
		return convert(
			Buffer.concat(this[RAW])
			, encoding
			, charset
		);
	}

}

/**
 * Clone body given Res/Req instance
 *
 * @param   Mixed  instance  Response or Request instance
 * @return  Mixed
 */
export function clone(instance) {
	let p1, p2;
	let body = instance.body;

	// don't allow cloning a used body
	if (instance.bodyUsed) {
		throw new Error('cannot clone body after it is used');
	}

	// check that body is a stream and not form-data object
	// note: we can't clone the form-data object without having it as a dependency
	if (bodyStream(body) && typeof body.getBoundary !== 'function') {
		// tee instance body
		p1 = new PassThrough();
		p2 = new PassThrough();
		body.pipe(p1);
		body.pipe(p2);
		// set instance body to teed body and return the other teed body
		instance.body = p1;
		body = p2;
	}

	return body;
}

// expose Promise
Body.Promise = global.Promise;
