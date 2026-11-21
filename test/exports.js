import http from 'node:http';
import {createRequire} from 'node:module';

import chai from 'chai';

// Self-reference: resolves through the "exports" map -> "import" condition
// -> src/index.js
import fetch, * as nodeFetch from 'node-fetch';

const {expect} = chai;

const namedExports = [
	'Headers',
	'Request',
	'Response',
	'FetchError',
	'AbortError',
	'FormData',
	'Blob',
	'File',
	'isRedirect',
	'fileFrom',
	'fileFromSync',
	'blobFrom',
	'blobFromSync'
];

// Regression tests for https://github.com/node-fetch/node-fetch/issues/1263
// The "import" condition must keep resolving to the ESM source, with both the
// default export and all named exports available.
describe('node-fetch package exports (ESM)', () => {
	it('import resolves to the ESM build with default and named exports', () => {
		expect(fetch).to.be.a('function');
		expect(nodeFetch.default).to.equal(fetch);
		expect(nodeFetch.fetch).to.equal(fetch);

		for (const name of namedExports) {
			expect(nodeFetch[name], `named export ${name}`).to.be.ok;
		}
	});

	it('the "require" condition of the exports map points at the CJS build', () => {
		const require = createRequire(import.meta.url);
		expect(require.resolve('node-fetch')).to.match(/lib[\\/]index\.cjs$/);
	});

	it('fetch() works end-to-end when loaded via import', async () => {
		const server = http.createServer((request, response) => {
			response.end('hello from esm');
		});

		await new Promise(resolve => {
			server.listen(0, '127.0.0.1', resolve);
		});

		try {
			const {port} = server.address();
			const response = await fetch(`http://127.0.0.1:${port}/`);
			expect(response.status).to.equal(200);
			expect(await response.text()).to.equal('hello from esm');
		} finally {
			server.close();
		}
	});
});
