import {PassThrough} from 'node:stream';

import chai from 'chai';
import {Request, Response} from '../src/index.js';

const {expect} = chai;

describe('Body.formData', () => {
	it('destroys body for invalid form data content type', async () => {
		const createBodies = [
			(body, headers) => new Response(body, {headers}),
			(body, headers) => new Request('https://example.com', {
				method: 'POST',
				body,
				headers
			})
		];

		for (const contentType of [undefined, 'text/plain']) {
			for (const createBody of createBodies) {
				const stream = new PassThrough();
				const headers = contentType === undefined ? {} : {'content-type': contentType};
				const body = createBody(stream, headers);
				let error;

				try {
					await body.formData();
				} catch (error_) {
					error = error_;
				}

				expect(error).to.be.instanceOf(TypeError);
				expect(error.message).to.equal('Failed to fetch');
				expect(stream.destroyed).to.be.true;
			}
		}
	});
});
