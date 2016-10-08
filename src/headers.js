
/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

export default class Headers {
	/**
	 * Headers class
	 *
	 * @param   Object  headers  Response headers
	 * @return  Void
	 */
	constructor(headers) {
		this._headers = {};

		// Headers
		if (headers instanceof Headers) {
			headers = headers.raw();
		}

		// plain object
		for (const prop in headers) {
			if (!headers.hasOwnProperty(prop)) {
				continue;
			}

			if (typeof headers[prop] === 'string') {
				this.set(prop, headers[prop]);
			} else if (typeof headers[prop] === 'number' && !isNaN(headers[prop])) {
				this.set(prop, headers[prop].toString());
			} else if (headers[prop] instanceof Array) {
				headers[prop].forEach(item => {
					this.append(prop, item.toString());
				});
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
		const list = this._headers[name.toLowerCase()];
		return list ? list[0] : null;
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

		return this._headers[name.toLowerCase()];
	}

	/**
	 * Iterate over all headers
	 *
	 * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
	 * @param   Boolean   thisArg   `this` context for callback function
	 * @return  Void
	 */
	forEach(callback, thisArg) {
		Object.getOwnPropertyNames(this._headers).forEach(name => {
			this._headers[name].forEach(value => {
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
		this._headers[name.toLowerCase()] = [value];
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

		this._headers[name.toLowerCase()].push(value);
	}

	/**
	 * Check for header name existence
	 *
	 * @param   String   name  Header name
	 * @return  Boolean
	 */
	has(name) {
		return this._headers.hasOwnProperty(name.toLowerCase());
	}

	/**
	 * Delete all header values given name
	 *
	 * @param   String  name  Header name
	 * @return  Void
	 */
	delete(name) {
		delete this._headers[name.toLowerCase()];
	};

	/**
	 * Return raw headers (non-spec api)
	 *
	 * @return  Object
	 */
	raw() {
		return this._headers;
	}
}
