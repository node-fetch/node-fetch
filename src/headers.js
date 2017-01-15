
/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

import { checkIsHttpToken, checkInvalidHeaderChar } from './common.js';

function sanitizeName(name) {
	name += '';
	if (!checkIsHttpToken(name)) {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
	return name.toLowerCase();
}

function sanitizeValue(value) {
	value += '';
	if (checkInvalidHeaderChar(value)) {
		throw new TypeError(`${value} is not a legal HTTP header value`);
	}
	return value;
}

export const MAP = Symbol('map');
const FOLLOW_SPEC = Symbol('followSpec');
export default class Headers {
	/**
	 * Headers class
	 *
	 * @param   Object  headers  Response headers
	 * @return  Void
	 */
	constructor(headers) {
		this[MAP] = Object.create(null);
		this[FOLLOW_SPEC] = Headers.FOLLOW_SPEC;

		// Headers
		if (headers instanceof Headers) {
		  let init = headers.raw();
		  for (let name of Object.keys(init)) {
		    for (let value of init[name]) {
		      this.append(name, value);
		    }
		  }
		} else if (typeof headers === 'object' && headers[Symbol.iterator]) {
			// array of tuples
			for (let el of headers) {
				if (typeof el !== 'object' || !el[Symbol.iterator]) {
					throw new TypeError('Header pairs must be an iterable object');
				}
				el = Array.from(el);
				if (el.length !== 2) {
					throw new TypeError('Header pairs must contain exactly two items');
				}
				this.append(el[0], el[1]);
			}
		} else if (typeof headers === 'object') {
			// plain object
			for (const prop of Object.keys(headers)) {
				// We don't worry about converting prop to ByteString here as append()
				// will handle it.
				this.append(prop, headers[prop]);
			}
		} else if (headers != null) {
			throw new TypeError('Provided initializer must be an object');
		}

		Object.defineProperty(this, Symbol.toStringTag, {
			value: 'Headers',
			writable: false,
			enumerable: false,
			configurable: true
		});
	}

	/**
	 * Return first header value given name
	 *
	 * @param   String  name  Header name
	 * @return  Mixed
	 */
	get(name) {
		const list = this[MAP][sanitizeName(name)];
		if (!list) {
			return null;
		}

		return this[FOLLOW_SPEC] ? list.join(',') : list[0];
	}

	/**
	 * Return all header values given name
	 *
	 * @param   String  name  Header name
	 * @return  Array
	 */
	getAll(name) {
		if (!this.has(name)) {
			return [];
		}

		return this[MAP][sanitizeName(name)];
	}

	/**
	 * Iterate over all headers
	 *
	 * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
	 * @param   Boolean   thisArg   `this` context for callback function
	 * @return  Void
	 */
	forEach(callback, thisArg = undefined) {
		let pairs = getHeaderPairs(this);
		let i = 0;
		while (i < pairs.length) {
			const [name, value] = pairs[i];
			callback.call(thisArg, value, name, this);
			pairs = getHeaderPairs(this);
			i++;
		}
	}

	/**
	 * Overwrite header values given name
	 *
	 * @param   String  name   Header name
	 * @param   String  value  Header value
	 * @return  Void
	 */
	set(name, value) {
		this[MAP][sanitizeName(name)] = [sanitizeValue(value)];
	}

	/**
	 * Append a value onto existing header
	 *
	 * @param   String  name   Header name
	 * @param   String  value  Header value
	 * @return  Void
	 */
	append(name, value) {
		if (!this.has(name)) {
			this.set(name, value);
			return;
		}

		this[MAP][sanitizeName(name)].push(sanitizeValue(value));
	}

	/**
	 * Check for header name existence
	 *
	 * @param   String   name  Header name
	 * @return  Boolean
	 */
	has(name) {
		return !!this[MAP][sanitizeName(name)];
	}

	/**
	 * Delete all header values given name
	 *
	 * @param   String  name  Header name
	 * @return  Void
	 */
	delete(name) {
		delete this[MAP][sanitizeName(name)];
	};

	/**
	 * Return raw headers (non-spec api)
	 *
	 * @return  Object
	 */
	raw() {
		return this[MAP];
	}

	/**
	 * Get an iterator on keys.
	 *
	 * @return  Iterator
	 */
	keys() {
		return createHeadersIterator(this, 'key');
	}

	/**
	 * Get an iterator on values.
	 *
	 * @return  Iterator
	 */
	values() {
		return createHeadersIterator(this, 'value');
	}

	/**
	 * Get an iterator on entries.
	 *
	 * This is the default iterator of the Headers object.
	 *
	 * @return  Iterator
	 */
	[Symbol.iterator]() {
		return createHeadersIterator(this, 'key+value');
	}
}
Headers.prototype.entries = Headers.prototype[Symbol.iterator];

Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
	value: 'HeadersPrototype',
	writable: false,
	enumerable: false,
	configurable: true
});

function getHeaderPairs(headers, kind) {
	if (headers[FOLLOW_SPEC]) {
		const keys = Object.keys(headers[MAP]).sort();
		return keys.map(
			kind === 'key' ?
				k => [k] :
				k => [k, headers.get(k)]
		);
	}

	const values = [];

	for (let name in headers[MAP]) {
		for (let value of headers[MAP][name]) {
			values.push([name, value]);
		}
	}

	return values;
}

const INTERNAL = Symbol('internal');

function createHeadersIterator(target, kind) {
	const iterator = Object.create(HeadersIteratorPrototype);
	iterator[INTERNAL] = {
		target,
		kind,
		index: 0
	};
	return iterator;
}

const HeadersIteratorPrototype = Object.setPrototypeOf({
	next() {
		// istanbul ignore if
		if (!this ||
			Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
			throw new TypeError('Value of `this` is not a HeadersIterator');
		}

		const {
			target,
			kind,
			index
		} = this[INTERNAL];
		const values = getHeaderPairs(target, kind);
		const len = values.length;
		if (index >= len) {
			return {
				value: undefined,
				done: true
			};
		}

		const pair = values[index];
		this[INTERNAL].index = index + 1;

		let result;
		if (kind === 'key') {
			result = pair[0];
		} else if (kind === 'value') {
			result = pair[1];
		} else {
			result = pair;
		}

		return {
			value: result,
			done: false
		};
	}
}, Object.getPrototypeOf(
	Object.getPrototypeOf([][Symbol.iterator]())
));

// On Node.js v0.12 the %IteratorPrototype% object is broken
if (typeof HeadersIteratorPrototype[Symbol.iterator] !== 'function') {
	HeadersIteratorPrototype[Symbol.iterator] = function () {
		return this;
	};
}

Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
	value: 'HeadersIterator',
	writable: false,
	enumerable: false,
	configurable: true
});

Headers.FOLLOW_SPEC = false;
