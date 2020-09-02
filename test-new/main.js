// Test tools
import test from 'ava';
import stream from 'stream';

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
		t.log(res)
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
	t.log(err)
	t.is(err.code, 'ECONNRESET');
});
