'use strict';

// Regression tests for https://github.com/node-fetch/node-fetch/issues/1263
//
// The package must be require()-able from CommonJS on every supported Node.js
// version (this file is loaded by mocha through require(), so on Node.js
// versions without require(esm) support the suite fails to even load if the
// "require" condition does not point at a real CommonJS build), and
// `require('node-fetch')` must be the fetch function itself (v2 interop),
// with all named exports attached to it.

const assert = require('node:assert/strict');
const http = require('node:http');

// Self-reference: resolves through the "exports" map -> "require" condition
// -> lib/index.cjs
const nodeFetch = require('node-fetch');

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

describe('node-fetch CommonJS entry (issue #1263)', () => {
	it('require("node-fetch") resolves to the CJS build', () => {
		assert.match(require.resolve('node-fetch'), /lib[\\/]index\.cjs$/);
	});

	it('require("node-fetch") returns the fetch function itself (v2 interop)', () => {
		assert.equal(typeof nodeFetch, 'function');
		assert.equal(nodeFetch.default, nodeFetch);
		assert.equal(nodeFetch.fetch, nodeFetch);
	});

	it('exposes all named exports on the required function', () => {
		for (const name of namedExports) {
			assert.ok(nodeFetch[name], `missing named export: ${name}`);
		}

		assert.equal(nodeFetch.isRedirect(301), true);
		assert.equal(nodeFetch.isRedirect(200), false);

		const headers = new nodeFetch.Headers({'x-test': 'yes'});
		assert.equal(headers.get('x-test'), 'yes');

		const request = new nodeFetch.Request('http://example.com/');
		assert.ok(request instanceof nodeFetch.Request);
		assert.equal(request.url, 'http://example.com/');

		assert.ok(new nodeFetch.FetchError('msg', 'system') instanceof Error);
		assert.ok(new nodeFetch.AbortError('msg') instanceof Error);
	});

	it('fetch() works end-to-end when loaded via require()', async () => {
		const server = http.createServer((request, response) => {
			response.end('hello from cjs');
		});

		await new Promise(resolve => {
			server.listen(0, '127.0.0.1', resolve);
		});

		try {
			const {port} = server.address();
			const response = await nodeFetch(`http://127.0.0.1:${port}/`);
			assert.equal(response.status, 200);
			assert.equal(await response.text(), 'hello from cjs');
		} finally {
			server.close();
		}
	});

	it('can still be loaded asynchronously with import() from CJS', async () => {
		const esm = await import('node-fetch');
		assert.equal(typeof esm.default, 'function');
		assert.equal(esm.fetch, esm.default);

		for (const name of namedExports) {
			assert.ok(esm[name], `missing ESM named export: ${name}`);
		}
	});
});
