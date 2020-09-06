// Test tools
import test from 'ava';
import stream from 'stream';
import zlib from 'zlib';
import delay from 'delay';
import AbortControllerPolyfill from 'abortcontroller-polyfill/dist/abortcontroller.js';
import AbortController2 from 'abort-controller';
import vm from 'vm';
import fs from 'fs';
import FormData from 'form-data';
import FormDataNode from 'formdata-node';
import path from 'path';

const {AbortController} = AbortControllerPolyfill;

// Test subjects
import Blob from 'fetch-blob';

import fetch, {
	FetchError,
	Headers,
	Request,
	Response
} from '../src/index.js';
import * as FetchErrorOrig from '../src/errors/fetch-error.js';
import HeadersOrig, {fromRawHeaders} from '../src/headers.js';
import RequestOrig from '../src/request.js';
import ResponseOrig from '../src/response.js';
import TestServer from './utils/server.js';

const {
	Uint8Array: VMUint8Array
} = vm.runInNewContext('this');

const local = new TestServer();
let base;

test.before(async () => {
	await local.start();
	base = `http://${local.hostname}:${local.port}/`;
});

test.after(async () => {
	await local.stop();
});

function streamToPromise(stream, dataHandler) {
	return new Promise((resolve, reject) => {
		stream.on('data', (...args) => {
			Promise.resolve()
				.then(() => dataHandler(...args))
				.catch(reject);
		});
		stream.on('end', resolve);
		stream.on('error', reject);
	});
}

test(`node-fetch - should return a promise`, t => {
	const url = `${base}hello`;
	const p = fetch(url);
	t.true(p instanceof Promise);
	// t.true(p.hasOwnProperty('then'), 'is chainable'); // FIXME:
})

test('should expose Headers, Response and Request constructors', t => {
	t.is(FetchError, FetchErrorOrig.FetchError);
	t.is(Headers, HeadersOrig);
	t.is(Response, ResponseOrig);
	t.is(Request, RequestOrig);
});

test('should support proper toString output for Headers, Response and Request objects', t => {
	t.is(new Headers().toString(), '[object Headers]');
	t.is(new Response().toString(), '[object Response]');
	t.is(new Request(base).toString(), '[object Request]');
});

test('should reject with error if url is protocol relative', async t => {
	const url = '//example.com/';
	await t.throwsAsync(() => fetch(url), {instanceOf: TypeError, message: /Invalid URL/});
});

test('should reject with error if url is relative path', async t => {
	const url = '/some/path';
	await t.throwsAsync(async () => await fetch(url), {instanceOf: TypeError, message: /Invalid URL/});
});

test('should reject with error if protocol is unsupported', async t => {
	const url = 'ftp://example.com'
	await t.throwsAsync(async () => await fetch(url), {instanceOf: TypeError, message: /URL scheme "ftp" is not supported/});
});

test('should reject with error on network failure', async t => {
	t.timeout(5000);
	const url = 'http://localhost:50000/';
	const err = await t.throwsAsync(async () => await fetch(url));
	t.true(err instanceof FetchError);
	t.is(err.code, 'ECONNREFUSED');
	t.is(err.errno, 'ECONNREFUSED');
	t.is(err.erroredSysCall, 'connect');
	t.is(err.type, 'system');
});

test('error should contain system error if one occurred', t => {
	const err = new FetchError('a message', 'system', new Error('an error'));
	t.true(err.hasOwnProperty('erroredSysCall'));
});

test('error should not contain system error if none occured', t => {
	const err = new FetchError('a message', 'a type');
	t.false(err.hasOwnProperty('errroredSysCall'));
});

test('system error is extracted from failed requests', async t => {
	t.timeout(5000);
	const url = 'http://localhost:5000/';
	const err = await t.throwsAsync(async () => await fetch(url));
	t.true(err instanceof FetchError);
	const properties = []
	for (const p in err) {
		properties.push(p)
	}
	const toCheck = [
		'type',
		'errno',
		'code',
		'erroredSysCall'
	];
	t.deepEqual(properties, toCheck);
});

test('should resolve into response', t => {
	const url = `${base}hello`;
	return fetch(url).then(res => {
		t.true(res instanceof Response);
		t.true(res.headers instanceof Headers);
		t.true(res.body instanceof stream.Transform);
		t.false(res.bodyUsed);
		t.deepEqual(res.url, url);
		t.true(res.ok);
		t.is(res.status, 200);
		t.is(res.statusText, 'OK')
	});
});

test('Repsonse.redirect should resolve into response', t => {
	const res = Response.redirect('http://localhost');
	t.true(res instanceof Response);
	t.true(res.headers instanceof Headers);
	t.is(res.headers.get('location'), 'http://localhost/');
	t.is(res.status, 302);
});

test('Response.redirect /w invalid url should fail', t => {
  t.throws(() => Response.redirect('localhost'), {instanceOf: TypeError, code: 'ERR_INVALID_URL'});
});

test('Response.redirect /w invalid status should fail', t => {
	t.throws(() => Response.redirect('http://localhost', 200), {instanceOf: RangeError});
});

test('should accept plain text response', t => {
	const url = `${base}plain`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain')
		return res.text().then(result => {
			t.true(res.bodyUsed);
			t.is(typeof result, 'string');
			t.is(result, 'text');
		});
	});
});

test('should accept html response (like plain text)', t => {
	const url = `${base}html`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/html');
		return res.text().then(result => {
			t.true(res.bodyUsed);
			t.is(typeof result, 'string');
			t.is(result, '<html></html>');
		});
	});
});

test('should accept json response', t => {
	const url = `${base}json`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'application/json');
		return res.json().then(result => {
			t.true(res.bodyUsed);
			t.is(typeof result, 'object');
			t.deepEqual(result, {name: 'value'});
		});
	});
});

test('should send request with custom headers', t => {
	const url = `${base}inspect`;
	const options = {
		headers: new Headers({'x-custom-header': 'abc'})
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.headers['x-custom-header'], 'abc')
	});
});

test('should accept custom host header', t => {
	const url = `${base}inspect`;
	const options = {
		headers: {
			host: 'example.com'
		}
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.headers.host, 'example.com');
	});
});

test('should follow redirect code 301', t => {
	const url = `${base}redirect/301`;
	return fetch(url).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		t.true(res.ok);
	});
});

test('should follow redirect code 302', t => {
	const url = `${base}redirect/302`;
	return fetch(url).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		t.true(res.ok);
	});
});

test('should follow redirect code 303', t => {
	const url = `${base}redirect/303`;
	return fetch(url).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		t.true(res.ok);
	});
});

test('should follow redirect code 307', t => {
	const url = `${base}redirect/307`;
	return fetch(url).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		t.true(res.ok);
	});
});

test('should follow redirect code 308', t => {
	const url = `${base}redirect/308`;
	return fetch(url).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		t.true(res.ok);
	});
});

test('should follow redirect chain', t => {
	const url = `${base}redirect/chain`;
	return fetch(url).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		t.true(res.ok);
	});
});

test('should follow POST request redirect code 301 with GET', t => {
	const url = `${base}redirect/301`;
	const options = {
		method: 'POST',
		body: 'a=1'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		return res.json().then(result => {
			t.is(result.method, 'GET');
			t.is(result.body, '');
		});
	});
});

test('should folow PATCH request redirect code 301 with PATCH', t => {
	const url = `${base}redirect/301`;
	const options = {
		method: 'PATCH',
		body: 'a=1'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		return res.json().then(res => {
			t.is(res.method, 'PATCH');
			t.is(res.body, 'a=1');
		});
	});
});

test('should follow POST request redirect code 302 with GET', t => {
	const url = `${base}redirect/302`;
	const options = {
		method: 'POST',
		body: 'a=1'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		return res.json().then(result => {
			t.is(result.method, 'GET');
			t.is(result.body, '');
		});
	});
});

test('should folow PATCH request redirect code 302 with PATCH', t => {
	const url = `${base}redirect/302`;
	const options = {
		method: 'PATCH',
		body: 'a=1'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		return res.json().then(res => {
			t.is(res.method, 'PATCH');
			t.is(res.body, 'a=1');
		});
	});
});

test('should folow redirect code 303 with GET', t => {
	const url = `${base}redirect/303`;
	const options = {
		method: 'PUT',
		body: 'a=1'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		return res.json().then(result => {
			t.is(result.method, 'GET');
			t.is(result.body, '');
		});
	});
});

test('should follow PATCH request redirect code 307 with PATCH', t => {
	const url = `${base}redirect/307`;
	const options = {
		method: 'PATCH',
		body: 'a=1'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
		return res.json().then(result => {
			t.is(result.method, 'PATCH');
			t.is(result.body, 'a=1');
		});
	});
});

test('should not follow non-GET redirect if body is a readable stream', async t => {
	const url = `${base}redirect/307`;
	const options = {
		method: 'PATCH',
		body: stream.Readable.from('tada')
	};
	const err = await t.throwsAsync(async () => await fetch(url, options));
	t.true(err instanceof FetchError);
	t.is(err.type, 'unsupported-redirect');
});

test('should obey maximum redirect, reject case', async t => {
	const url = `${base}redirect/chain`;
	const options = {
		follow: 1
	};
	const err = await t.throwsAsync(async () => await fetch(url, options));
	t.true(err instanceof FetchError);
	t.is(err.type, 'max-redirect');
})

test('should obey redirect chain, resolve case', t => {
	const url = `${base}redirect/chain`;
	const options = {
		follow: 2
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		t.is(res.status, 200);
	});
});

test('should allow not following redirect', async t => {
	const url = `${base}redirect/301`;
	const options = {
		follow: 0
	};
	const err = await t.throwsAsync(async () => await fetch(url, options));
	t.true(err instanceof FetchError);
	t.is(err.type, 'max-redirect');
});

test('should support redirect mode, manual flag', t => {
	const url = `${base}redirect/301`;
	const options = {
		redirect: 'manual'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, url);
		t.is(res.status, 301);
		t.is(res.headers.get('location'), `${base}inspect`);
	});
});

test('should support redirect mode, error flag', async t => {
	const url = `${base}redirect/301`;
	const options = {
		redirect: 'error'
	};
	const err = await t.throwsAsync(async () => await fetch(url, options));
	t.true(err instanceof FetchError);
	t.is(err.type, 'no-redirect');
});

test('should support redirect mode, manual flag when there is no redirect', t => {
	const url = `${base}hello`;
	const options = {
		redirect: 'manual'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, url);
		t.is(res.status, 200);
		t.is(res.headers.get('location'), null);
	});
});

test('should follow redirect code 301 and keep existing headers', t => {
	const url = `${base}redirect/301`;
	const options = {
		headers: new Headers({'x-custom-header': 'abc'})
	};
	return fetch(url, options).then(res => {
		t.is(res.url, `${base}inspect`);
		return res.json();
	}).then(res => {
		t.is(res.headers['x-custom-header'], 'abc');
	});
});

test('should treat broken redirect as ordinary response (follow)', t => {
	const url = `${base}redirect/no-location`;
	return fetch(url).then(res => {
		t.is(res.url, url);
		t.is(res.status, 301);
		t.is(res.headers.get('location'), null);
	});
});

test('should treat broken redirect as ordinary response (manual)', t => {
	const url = `${base}redirect/no-location`;
	const options = {
		redirect: 'manual'
	};
	return fetch(url, options).then(res => {
		t.is(res.url, url);
		t.is(res.status, 301);
		t.is(res.headers.get('location'), null);
	});
});

test('should set redirected property on response when redirect', t => {
	const url = `${base}redirect/301`;
	return fetch(url).then(res => {
		t.true(res.redirected);
	});
});

test('should not set redirected property on response without redirect', t => {
	const url = `${base}hello`;
	return fetch(url).then(res => {
		t.false(res.redirected);
	});
});

test('should ignore invalid headers', t => {
	const headers = fromRawHeaders([
		'Invalid-Header ',
		'abc\r\n',
		'Invalid-Header-Value',
		'\u0007k\r\n',
		'Cookie',
		'\u0007k\r\n',
		'Cookie',
		'\u0007kk\r\n'
	]);
	t.true(headers instanceof Headers);
	t.deepEqual(headers.raw(), {});
});

test('should handle client-error response', t => {
	const url = `${base}error/400`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		t.is(res.status, 400);
		t.is(res.statusText, 'Bad Request');
		t.false(res.ok);
		return res.text().then(result => {
			t.true(res.bodyUsed);
			t.is(typeof result, 'string');
			t.is(result, 'client error');
		});
	});
});

test('should handle server-error response', t => {
	const url = `${base}error/500`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		t.is(res.status, 500);
		t.is(res.statusText, 'Internal Server Error');
		t.false(res.ok);
		return res.text().then(result => {
			t.true(res.bodyUsed);
			t.is(typeof result, 'string');
			t.is(result, 'server error');
		});
	});
});

test('should handle network-error response', async t => {
	const url = `${base}error/reset`;
	const err = await t.throwsAsync(async () => await fetch(url));
	t.true(err instanceof FetchError);
	t.is(err.code, 'ECONNRESET');
});

test.serial('should handle network-error partial response', async t => {
	const url = `${base}error/premature`;
	return fetch(url).then(async res => {
		t.is(res.status, 200);
		t.true(res.ok);
		await t.throwsAsync(() => res.text(), {instanceOf: Error, message: /Premature close|The operation was aborted/});
	})
});

test.skip('should handle DNS-error response', async t => {
	const url = 'http://domain.invalid';
	const err = await t.throwsAsync(() => fetch(url));
	t.true(err instanceof FetchError);
	t.is(err.code, /ENOTFOUND|EAI_AGAIN/);
});

test.serial('should reject invalid json response', t => {
	const url = `${base}error/json`;
	return fetch(url).then(async res => {
		t.is(res.headers.get('content-type'), 'application/json');
		await t.throwsAsync(() => res.json(), {instanceOf: Error});
	})
})

test('should handle no content response', t => {
	const url = `${base}no-content`;
	return fetch(url).then(res => {
		t.is(res.status, 204);
		t.is(res.statusText, 'No Content');
		t.true(res.ok)
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.falsy(result);
		});
	});
});

test('should reject when trying to parse no content response as json', t => {
	const url = `${base}no-content`;
	return fetch(url).then(async res => {
		t.is(res.status, 204);
		t.is(res.statusText, 'No Content');
		t.true(res.ok);
		await t.throwsAsync(() => res.json(), {instanceOf: Error});
	});
});

test('should handle no content response with gzip encoding', t => {
	const url = `${base}no-content/gzip`;
	return fetch(url).then(res => {
		t.is(res.status, 204);
		t.is(res.statusText, 'No Content');
		t.is(res.headers.get('content-encoding'), 'gzip');
		t.true(res.ok);
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.falsy(result);
		});
	});
});

test('should handle not modified response', t => {
	const url = `${base}not-modified`;
	return fetch(url).then(res => {
		t.is(res.status, 304);
		t.is(res.statusText, 'Not Modified');
		t.false(res.ok);
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.falsy(result);
		});
	});
});

test('should handle not modified response with gzip encoding', t => {
	const url = `${base}not-modified/gzip`;
	return fetch(url).then(res => {
		t.is(res.status, 304);
		t.is(res.statusText, 'Not Modified');
		t.is(res.headers.get('content-encoding'), 'gzip');
		t.false(res.ok);
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.falsy(result);
		});
	});
});

test('should decompress gzip response', t => {
	const url = `${base}gzip`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.is(result, 'hello world');
		});
	});
});

test('should decompress slightly invalid gzip response', t => {
	const url = `${base}gzip-truncated`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.is(result, 'hello world');
		});
	});
});

test('should make capitalised Content-Encoding lowercase', t => {
	const url = `${base}gzip-capital`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-encoding'), 'gzip');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.is(result, 'hello world');
		});
	});
});

test('should decompress deflate response', t => {
	const url = `${base}deflate`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.is(result, 'hello world');
		});
	});
});

test('should decompress deflate raw response from old apache server', t => {
	const url = `${base}deflate-raw`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.is(result, 'hello world');
		});
	});
});

test('should decompress brotli response', t => {
	if (typeof zlib.createBrotliDecompress !== 'function') {
		t.pass()
	}

	const url = `${base}brotli`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.is(result, 'hello world');
		});
	});
});

test('should handle no content response with brotli encoding', t => {
	if (typeof zlib.createBrotliDecompress !== 'function') {
		t.pass();
	}

	const url = `${base}no-content/brotli`;
	return fetch(url).then(res => {
		t.is(res.status, 204);
		t.is(res.statusText, 'No Content');
		t.is(res.headers.get('content-encoding'), 'br');
		t.true(res.ok);
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.falsy(result);
		});
	});
});

test('should skip decompression if unsupported', t => {
	const url = `${base}sdch`;
	return fetch(url).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.is(result, 'fake sdch string');
		});
	});
});

test('should reject if response compression is invalid', t => {
	const url = `${base}invalid-content-encoding`;
	return fetch(url).then(async res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		const err = await t.throwsAsync(() => res.text(), {instanceOf: FetchError});
		t.is(err.code, 'Z_DATA_ERROR');
	});
});

test.cb('should handle errors on the body stream even if it is not used', t => {
	const url = `${base}invalid-content-encoding`;
	fetch(url)
		.then(res => {
			t.is(res.status, 200);
		})
		.catch(() => { })
		.then(() => {
			// Wait a few ms to see if a uncaught error occurs
			setTimeout(() => {
				t.end()
			}, 20);
		});
});

test('should collect handled errors on the body stream to reject if the body is used later', t => {
	const url = `${base}invalid-content-encoding`;
	return fetch(url).then(delay(20)).then(async res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		const err = await t.throwsAsync(() => res.text(), {instanceOf: FetchError});
		t.is(err.code, 'Z_DATA_ERROR');
	});
});

test('should allow disabling auto decompression', t => {
	const url = `${base}gzip`;
	const options = {
		compress: false
	};
	return fetch(url, options).then(res => {
		t.is(res.headers.get('content-type'), 'text/plain');
		return res.text().then(result => {
			t.is(typeof result, 'string');
			t.not(result, 'hello world');
		});
	});
});

test('should not overwrite existing accept-encoding header when auto decompression is true', t => {
	const url = `${base}inspect`;
	const options = {
		compress: true,
		headers: {
			'Accept-Encoding': 'gzip'
		}
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.headers['accept-encoding'], 'gzip');
	});
});

test('should support request cancellation with signal', async t => {
	t.timeout(500);
	const controller = new AbortController();
	const controller2 = new AbortController2();

	const fetches = [
		fetch(`${base}timeout`, {signal: controller.signal}),
		fetch(`${base}timeout`, {signal: controller2.signal}),
		fetch(`${base}timeout`, {
			method: 'POST',
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
				body: JSON.stringify({hello: 'world'})
			}
		})
	];

	setTimeout(() => {
		controller.abort();
		controller2.abort();
	}, 100)

	for (const fetched of fetches) {
		const err = await t.throwsAsync(() => fetched, {instanceOf: Error, name: 'AbortError'});
		t.is(err.type, 'aborted');
	}
});

test('should reject immediately if signal has already been aborted', async t => {
	const url = `${base}timeout`;
	const controller = new AbortController();
	const options = {
		signal: controller.signal
	};
	controller.abort();
	const fetched = fetch(url, options);
	const err = await t.throwsAsync(() => fetched, {instanceOf: Error, name: 'AbortError'});
	t.is(err.type, 'aborted');
});

test.skip('should remove internal AbortSignal event listener after request is aborted', async t => {
	const controller = new AbortController();
	const {signal} = controller;
	const promise = fetch(
		`${base}timeout`,
		{signal}
	);

	await t.throwsAsync(() => promise.then(() => {
		t.is(signal.listeners.abort.length, 0);
	}), {instanceOf: Error, name: 'AbortError'});
	// controller.abort();
	// return;
});

test('should allow redirects to be aborted', async t => {
	const abortController = new AbortController();
	const request = new Request(`${base}redirect/slow`, {
		signal: abortController.signal
	});
	setTimeout(() => {
		abortController.abort();
	}, 20);
	await t.throwsAsync(() => fetch(request), {instanceOf: Error, name: 'AbortError'});
});

test('should allow redirected response body to be aborted', async t => {
	const abortController = new AbortController();
	const request = new Request(`${base}redirect/slow-stream`, {
		signal: abortController.signal
	});

	await t.throwsAsync(() => fetch(request).then(res => {
		t.log(res)
		t.is(res.headers.get('Content-type'), 'text/plain');
		const result = res.text();
		abortController.abort();
		return result;
	}), {instanceOf: Error, name: 'AbortError'});
});

test.skip('should remove internal AbortSignal event listener after request and response complete without aborting', async t => {
	const controller = new AbortController();
	const {signal} = controller;
	const fetchHtml = fetch(`${base}html`, {signal})
		.then(res => res.text());
	const fetchResponseError = fetch(`${base}error/reset`, {signal});
	const fetchRedirect = fetch(`${base}redirect/301`, {signal}).then(res => res.json());

	await Promise.all([
		t.notThrows(() => fetchHtml),
		t.throwsAsync(() => fetchResponseError),
		t.notThrows(() => fetchRedirect)
	]).then(() => {
		t.is(signal.listeners.abort.length, 0);
	});
});

test('should reject response body with AbortError when aborted before stream has been read completely', t => {
	const controller = new AbortController();
	return fetch(`${base}slow`, {signal: controller.signal})
		.then(async res => {
			const promise = res.text();
			controller.abort()
			await t.throwsAsync(() => promise, {instanceOf: Error, name: 'AbortError'})
		});
});

test('should reject response body methods immediately with AbortError when aborted before stream is disturbed', t => {
	const controller = new AbortController();
	return fetch(`${base}slow`, {signal: controller.signal})
		.then(async res => {
			controller.abort()
			await t.throwsAsync(() => res.text(), {instanceOf: Error, name: 'AbortError'});
		});
});

test.cb('should emit error event to response body with an AbortError when aborted before underlying stream is closed', t => {
	const controller = new AbortController();
	fetch(`${base}slow`, {signal: controller.signal})
		.then(res => {
			res.body.once('error', err => {
				t.true(err instanceof Error);
				t.is(err.name, 'AbortError');
				t.end()
			});
			controller.abort();
		});
});

test('should cancel request body of type Stream with AbortError when aborted', async t => {
	const controller = new AbortController();
	const body = new stream.Readable({objectMode: true});
	body._read = () => { };
	const promise = fetch(
		`${base}slow`,
		{signal: controller.signal, body, method: 'POST'}
	);

	const result = Promise.all([
		new Promise((resolve, reject) => {
			body.on('error', error => {
				try {
					t.true(error instanceof Error);
					t.is(error.name, 'AbortError')
					resolve();
				} catch (error_) {
					reject(error_);
				}
			});
		}),
		t.throwsAsync(() => promise, {instanceOf: Error, name: 'AbortError'})
	]);

	controller.abort();

	await result
});

test('should throw a TypeError if a signal is not of type AbortSignal', async t => {
	const url = `${base}inspect`
	await Promise.all([
		t.throwsAsync(() => fetch(url, {signal: {}}), {instanceOf: TypeError, message: /AbortSignal/}),
		t.throwsAsync(() => fetch(url, {signal: ''}), {instanceOf: TypeError, message: /AbortSignal/}),
		t.throwsAsync(() => fetch(url, {signal: Object.create(null)}), {instanceOf: TypeError, message: /AbortSignal/})
	]);
});

test('should set default User-Agent', t => {
	const url = `${base}inspect`;
	return fetch(url).then(res => res.json()).then(res => {
		t.is(res.headers['user-agent'], 'node-fetch');
	});
});

test('should allow setting User-Agent', t => {
	const url = `${base}inspect`;
	const options = {
		headers: {
			'user-agent': 'faked'
		}
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.headers['user-agent'], 'faked');
	});
});

test('should set default Accept header', t => {
	const url = `${base}inspect`;
	return fetch(url).then(res => res.json()).then(res => {
		t.is(res.headers.accept, '*/*');
	});
});

test('should allow setting Accept header', t => {
	const url = `${base}inspect`;
	const options = {
		headers: {
			accept: 'application/json'
		}
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.headers.accept, 'application/json');
	});
});

test('should allow POST request', t => {
	const url = `${base}inspect`;
	const options = {
		method: 'POST'
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '0');
	});
});

test('should allow POST request with buffer body', t => {
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: Buffer.from('a=1', 'utf-8')
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'a=1');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '3');
	});
});

test('should allow POST request with ArrayBuffer body', t => {
	const encoder = new TextEncoder();
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: encoder.encode('Hello, world!\n').buffer
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'Hello, world!\n');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '14');
	});
});

test('should allow POST request with ArrayBuffer body from a VM context', t => {
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: new VMUint8Array(Buffer.from('Hello, world!\n')).buffer
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'Hello, world!\n');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '14');
	});
});

test('should allow POST request with ArrayBufferView (Uint8Array) body', t => {
	const encoder = new TextEncoder();
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: encoder.encode('Hello, world!\n')
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'Hello, world!\n');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '14');
	});
});

test('should allow POST request with ArrayBufferView (DataView) body', t => {
	const encoder = new TextEncoder();
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: new DataView(encoder.encode('Hello, world!\n').buffer)
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'Hello, world!\n');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '14');
	});
});

test('should allow POST request with ArrayBufferView (Uint8Array) body from a VM context', t => {
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: new VMUint8Array(Buffer.from('Hello, world!\n'))
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'Hello, world!\n');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '14');
	});
});

test('should allow POST request with ArrayBufferView (Uint8Array, offset, length) body', t => {
	const encoder = new TextEncoder();
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: encoder.encode('Hello, world!\n').subarray(7, 13)
	};
	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'world!');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '6');
	});
});

test('should allow POST request with blob body without type', t => {
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: new Blob(['a=1'])
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'a=1');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], '3');
	});
});

test('should allow POST request with blob body with type', t => {
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: new Blob(['a=1'], {
			type: 'text/plain;charset=UTF-8'
		})
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'a=1');
		t.is(res.headers['transfer-encoding'], undefined);
		t.is(res.headers['content-type'], 'text/plain;charset=utf-8');
		t.is(res.headers['content-length'], '3');
	});
});

test('should allow POST request with readable stream as body', t => {
	const url = `${base}inspect`;
	const options = {
		method: 'POST',
		body: stream.Readable.from('a=1')
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, 'a=1');
		t.is(res.headers['transfer-encoding'], 'chunked');
		t.is(res.headers['content-type'], undefined);
		t.is(res.headers['content-length'], undefined);
	});
});

test('should allow POST request with form-data as body', t => {
	const form = new FormData();
	form.append('a', '1');

	const url = `${base}multipart`;
	const options = {
		method: 'POST',
		body: form
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.true(res.headers['content-type'].startsWith('multipart/form-data;boundary='));
		t.is(typeof res.headers['content-length'], 'string');
		t.is(res.body, 'a=1');
	});
});

test('should allow POST request with form-data using stream as body', t => {
	const form = new FormData();
	form.append('my_field', fs.createReadStream('test-new/utils/dummy.txt'));

	const url = `${base}multipart`;
	const options = {
		method: 'POST',
		body: form
	};

	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.true(res.headers['content-type'].startsWith('multipart/form-data;boundary='));
		t.is(res.headers['content-length'], undefined);
		t.true(res.body.startsWith('my_field='));
	});
});

test('should allow POST request with form-data as body and custom headers', t => {
	const form = new FormData();
	form.append('a', '1');

	const headers = form.getHeaders();
	headers.b = '2';

	const url = `${base}multipart`;
	const options = {
		method: 'POST',
		body: form,
		headers
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.true(res.headers['content-type'].startsWith('multipart/form-data; boundary='));
		t.is(typeof res.headers['content-length'], 'string');
		t.is(res.headers.b, '2');
		t.is(res.body, 'a=1');
	});
});

test('should support spec-compliant form-data as POST body', t => {
	const form = new FormDataNode();

	const filename = path.join('test-new', 'utils', 'dummy.txt');

	form.set('field', 'some text');
	form.set('file', fs.createReadStream(filename), {
		size: fs.statSync(filename).size
	});

	const url = `${base}multipart`;
	const options = {
		method: 'POST',
		body: form
	};

	return fetch(url, options).then(res => res.json()).then(res => {
		t.is(res.method, 'POST');
		t.true(res.headers['content-type'].startsWith('multipart/form-data'));
		t.true(res.body.includes('field='));
		t.true(res.body.includes('file='));
	});
});

test('should allow POST request with object body', t => {
	const url = `${base}inspect`;
	// Note that fetch simply calls tostring on an object
	const options = {
		method: 'POST',
		body: {a: 1}
	};
	return fetch(url, options).then(res => {
		return res.json();
	}).then(res => {
		t.is(res.method, 'POST');
		t.is(res.body, '[object Object]');
		t.is(res.headers['content-type'], 'text/plain;charset=UTF-8');
		t.is(res.headers['content-length'], '15');
	});
});
