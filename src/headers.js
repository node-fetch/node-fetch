
/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

import { _checkIsHttpToken, _checkInvalidHeaderChar } from './common.js';

function sanitizeName(name) {
	name += '';
	if (!_checkIsHttpToken(name)) {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
	return name.toLowerCase();
}

function sanitizeValue(value) {
	value += '';
	if (_checkInvalidHeaderChar(value)) {
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
		this[MAP] = {};
		this[FOLLOW_SPEC] = Headers.FOLLOW_SPEC;

		// Headers
		if (headers instanceof Headers) {
		  let init = headers.raw();
		  for (let name of Object.keys(init)) {
		    for (let value of init[name]) {
		      this.append(name, value);
		    }
		  }
		} else if (Array.isArray(headers)) {
			// array of tuples
			for (let el of headers) {
				if (!Array.isArray(el) || el.length !== 2) {
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
		}
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
	forEach(callback, thisArg) {
		Object.getOwnPropertyNames(this[MAP]).forEach(name => {
			this[MAP][name].forEach(value => {
				callback.call(thisArg, value, name, this);
			});
		});
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
		return this[MAP].hasOwnProperty(sanitizeName(name));
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
		let keys = [];
		if (this[FOLLOW_SPEC]) {
			keys = Object.keys(this[MAP]).sort();
		} else {
			this.forEach((_, name) => keys.push(name));
		};
		return new Iterator(keys);
	}

	/**
	 * Get an iterator on values.
	 *
	 * @return  Iterator
	 */
	*values() {
		if (this[FOLLOW_SPEC]) {
			for (const name of this.keys()) {
				yield this.get(name);
			}
		} else {
			const values = [];
			this.forEach(value => values.push(value));
			yield* new Iterator(values);
		}
	}

	/**
	 * Get an iterator on entries.
	 *
	 * @return  Iterator
	 */
	*entries() {
		if (this[FOLLOW_SPEC]) {
			for (const name of this.keys()) {
				yield [name, this.get(name)];
			}
		} else {
			const entries = [];
			this.forEach((value, name) => entries.push([name, value]));
			yield* new Iterator(entries);
		}
	}

	/**
	 * Get an iterator on entries.
	 *
	 * This is the default iterator of the Headers object.
	 *
	 * @return  Iterator
	 */
	[Symbol.iterator]() {
		return this.entries();
	}

	/**
	 * Tag used by `Object.prototype.toString()`.
	 */
	get [Symbol.toStringTag]() {
		return 'Headers';
	}
}

Headers.FOLLOW_SPEC = false;

const ITEMS = Symbol('items');
class Iterator {
	constructor(items) {
		this[ITEMS] = items;
	}

	next() {
		if (!this[ITEMS].length) {
			return {
				value: undefined,
				done: true
			};
		}

		return {
			value: this[ITEMS].shift(),
			done: false
		};

	}

	[Symbol.iterator]() {
		return this;
	}
}
