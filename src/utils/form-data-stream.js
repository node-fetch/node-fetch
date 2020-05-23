import {Readable} from 'stream';

import {isBlob} from './is.js';

class FormDataStream extends Readable {
	constructor(form, boundary) {
		super();

		this._carriage = '\r\n';
		this._dashes = '-'.repeat(2);
		this._boundary = boundary;
		this._form = form;
		this._curr = this._readField();
	}

	_getHeader(name, field) {
		let header = '';

		header += `${this._dashes}${this._boundary}${this._carriage}`;
		header += `Content-Disposition: form-data; name="${name}"`;

		if (isBlob(field)) {
			header += `; filename="${field.name}"${this._carriage}`;
			header += `Content-Type: ${field.type || 'application/octet-stream'}`;
		}

		return `${header}${this._carriage.repeat(2)}`;
	}

	async * _readField() {
		for (const [name, field] of this._form) {
			yield this._getHeader(name, field);

			if (isBlob(field)) {
				yield * field.stream();
			} else {
				yield field;
			}

			yield this._carriage;
		}

		yield `${this._dashes}${this._boundary}${this._dashes}${this._carriage.repeat(2)}`;
	}

	_read() {
		const onFulfilled = ({done, value}) => {
			if (done) {
				return this.push(null);
			}

			this.push(Buffer.isBuffer(value) ? value : Buffer.from(String(value)));
		};

		const onRejected = err => this.emit('error', err);

		this._curr.next().then(onFulfilled).catch(onRejected);
	}
}

export default FormDataStream;
