/**
 * Headers.js
 *
 * Headers class offers convenient helpers
 */

const invalidTokenRegex = /[^`\-\w!#$%&'*+.|~]/;
const invalidHeaderCharRegex = /[^\t\u0020-\u007E\u0080-\u00FF]/;

function validateName(name) {
	name = String(name);
	if (invalidTokenRegex.test(name) || name === '') {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
}

function validateValue(value) {
	value = String(value);
	if (invalidHeaderCharRegex.test(value)) {
		throw new TypeError(`${value} is not a legal HTTP header value`);
	}
}

/**
 * @typedef {Headers | string[][] | Record<string, string>} HeadersInit
 */

/**
 * This Fetch API interface allows you to perform various actions on HTTP request and response headers.
 * These actions include retrieving, setting, adding to, and removing.
 * A Headers object has an associated header list, which is initially empty and consists of zero or more name and value pairs.
 * You can add to this using methods like append() (see Examples.)
 * In all methods of this interface, header names are matched by case-insensitive byte sequence.
 *
 */
export default class Headers extends URLSearchParams {
	/**
	 * Headers class
	 *
	 * @constructor
	 * @param {HeadersInit} [init] - Response headers
	 */
	constructor(init) {
		// Validate and normalize init object in [name, value(s)][]

		if (init instanceof Headers) {
			const raw = init.raw();
			init = [];
			for (const [name, values] of Object.entries(raw)) {
				for (const value of values) {
					init.push([name, value]);
				}
			}
		} else if (init == null) { // eslint-disable-line no-eq-null, eqeqeq
			// No op
		} else if (typeof init === 'object') {
			// We don't worry about converting prop to ByteString here as append()
			// will handle it.
			const result = [];
			const method = init[Symbol.iterator];
			// eslint-disable-next-line no-eq-null, eqeqeq
			if (method != null) {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// Sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				const pairs = [];
				for (const pair of init) {
					if (
						typeof pair !== 'object' ||
						typeof pair[Symbol.iterator] !== 'function'
					) {
						throw new TypeError('Each header pair must be iterable');
					}

					pairs.push([...pair]);
				}

				for (const pair of pairs) {
					if (pair.length !== 2) {
						throw new TypeError('Each header pair must be a name/value tuple');
					}

					result.push([pair[0], pair[1]]);
				}
			} else {
				// Record<ByteString, ByteString>
				for (const [key, value] of Object.entries(init)) {
					result.push([key, value]);
				}
			}

			// Validate and lowercase
			init =
				result.length > 0 ?
					result.map(([name, value]) => {
						validateName(name);
						validateValue(value);
						return [String(name).toLowerCase(), value];
					}) :
					undefined;
		} else {
			throw new TypeError('Provided initializer must be an object');
		}

		super(init);

		// Returning a Proxy that will lowercase key names, validate parameters and sort keys
		// eslint-disable-next-line no-constructor-return
		return new Proxy(this, {
			get(target, p, receiver) {
				switch (p) {
					case 'append':
					case 'set':
						return (name, value) => {
							validateName(name);
							validateValue(value);
							return URLSearchParams.prototype[p].call(
								receiver,
								String(name).toLowerCase(),
								value
							);
						};

					case 'delete':
					case 'has':
					case 'getAll':
						return name => {
							validateName(name);
							return URLSearchParams.prototype[p].call(
								receiver,
								String(name).toLowerCase()
							);
						};

					case 'keys':
						return () => {
							target.sort();
							return new Set(URLSearchParams.prototype.keys.call(target)).keys();
						};

					default:
						return Reflect.get(target, p, receiver);
				}
			}
		});
	}

	get [Symbol.toStringTag]() {
		return 'Headers';
	}

	toString() {
		return Object.prototype.toString.call(this);
	}

	get(name) {
		const values = this.getAll(name);
		if (values.length === 0) {
			return null;
		}

		let value = values.join(', ');
		if (/^content-encoding$/i.test(name)) {
			value = value.toLowerCase();
		}

		return value;
	}

	forEach(callback) {
		for (const name of this.keys()) {
			callback(this.getAll(name).join(', '), name);
		}
	}

	* values() {
		for (const name of this.keys()) {
			yield this.getAll(name).join(', ');
		}
	}

	/**
	 * @type {() => IterableIterator<[string, string]>}
	 */
	* entries() {
		for (const name of this.keys()) {
			yield [name, this.getAll(name).join(', ')];
		}
	}

	[Symbol.iterator]() {
		return this.entries();
	}

	/**
	 * Node-fetch non-spec method
	 * returning all headers and their values as array
	 * @returns {Record<string, string[]>}
	 */
	raw() {
		return [...this.keys()].reduce((res, key) => {
			res[key] = this.getAll(key);
			return res;
		}, {});
	}

	/**
	 * For better console.log(headers) and also to convert Headers into Node.js Request compatible format
	 */
	[Symbol.for('nodejs.util.inspect.custom')]() {
		return [...this.keys()].reduce((res, key) => {
			const values = this.getAll(key);
			// Http.request() only supports string as Host header.
			// This hack makes specifying custom Host header possible.
			if (key === 'host') {
				res[key] = values[0];
			} else {
				res[key] = values.length > 1 ? values : values[0];
			}

			return res;
		}, {});
	}
}

/**
 * Re-shaping object for Web IDL tests
 * Only need to do it for overridden methods
 */
Object.defineProperties(
	Headers.prototype,
	['get', 'entries', 'forEach', 'values'].reduce((res, property) => {
		res[property] = {enumerable: true};
		return res;
	}, {})
);

/**
 * Create a Headers object from an object of headers, ignoring those that do
 * not conform to HTTP grammar productions.
 *
 * @param {Record<string, string | string[]>} object  Object of headers
 * @returns {Headers}
 */
export function createHeadersLenient(object) {
	const headers = new Headers();
	for (const [name, values] of Object.entries(object)) {
		if (invalidTokenRegex.test(name)) {
			continue;
		}

		if (Array.isArray(values)) {
			for (const value of values) {
				if (invalidHeaderCharRegex.test(value)) {
					continue;
				}

				headers.append(name, value);
			}
		} else if (!invalidHeaderCharRegex.test(values)) {
			headers.append(name, values);
		}
	}

	return headers;
}
