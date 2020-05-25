import {Readable} from 'stream';

import {isBlob} from './is.js';

const carriage = '\r\n';
const dashes = '-'.repeat(2);

/**
 * @param {string} boundary
 * @param {string} name
 * @param {*} field
 *
 * @return {string}
 */
function getHeader(boundary, name, field) {
	let header = '';

		header += `${dashes}${boundary}${carriage}`;
		header += `Content-Disposition: form-data; name="${name}"`;

		if (isBlob(field)) {
			header += `; filename="${field.name}"${carriage}`;
			header += `Content-Type: ${field.type || 'application/octet-stream'}`;
		}

		return `${header}${carriage.repeat(2)}`;
}

/**
 * @param {FormData} form
 * @param {string} boundary
 */
async function* formDataIterator(form, boundary) {
	for (const [name, value] of form) {
			yield getHeader(boundary, name, value);

			if (isBlob(value)) {
				yield * value.stream();
			} else {
				yield value;
			}

			yield carriage;
		}

	yield `${dashes}${boundary}${dashes}${carriage.repeat(2)}`;
}

export default formDataIterator;
