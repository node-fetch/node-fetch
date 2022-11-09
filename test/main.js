// Test tools
import {lookup} from 'node:dns';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import stream from 'node:stream';
import vm from 'node:vm';
import zlib from 'node:zlib';

import {text} from 'stream-consumers';
import AbortControllerMysticatea from 'abort-controller';
import abortControllerPolyfill from 'abortcontroller-polyfill/dist/abortcontroller.js';
import chai from 'chai';
import chaiIterator from 'chai-iterator';
import chaiPromised from 'chai-as-promised';
import chaiString from 'chai-string';
import FormData from 'form-data';

import fetch, {
	Blob,
	FetchError,
	fileFromSync,
	FormData as FormDataNode,
	Headers,
	Request,
	Response
} from '../src/index.js';
import {FetchError as FetchErrorOrig} from '../src/errors/fetch-error.js';
import HeadersOrig, {fromRawHeaders} from '../src/headers.js';
import RequestOrig from '../src/request.js';
import ResponseOrig from '../src/response.js';
import Body, {getTotalBytes, extractContentType} from '../src/body.js';
import TestServer from './utils/server.js';
import chaiTimeout from './utils/chai-timeout.js';
import {isDomainOrSubdomain, isSameProtocol} from '../src/utils/is.js';

const AbortControllerPolyfill = abortControllerPolyfill.AbortController;
const encoder = new TextEncoder();

function isNodeLowerThan(version) {
	return !~process.version.localeCompare(version, undefined, {numeric: true});
}

const {
	Uint8Array: VMUint8Array
} = vm.runInNewContext('this');

chai.use(chaiPromised);
chai.use(chaiIterator);
chai.use(chaiString);
chai.use(chaiTimeout);
const {expect} = chai;

describe('node-fetch', () => {
	const local = new TestServer();
	let base;

	before(async () => {
		await local.start();
		base = `http://${local.hostname}:${local.port}/`;
	});

	after(async () => {
		return local.stop();
	});

	it('should return a promise', () => {
		const url = `${base}hello`;
		const p = fetch(url);
		expect(p).to.be.an.instanceof(Promise);
		expect(p).to.have.property('then');
	});

	it('should expose Headers, Response and Request constructors', () => {
		expect(FetchError).to.equal(FetchErrorOrig);
		expect(Headers).to.equal(HeadersOrig);
		expect(Response).to.equal(ResponseOrig);
		expect(Request).to.equal(RequestOrig);
	});

	it('should support proper toString output for Headers, Response and Request objects', () => {
		expect(new Headers().toString()).to.equal('[object Headers]');
		expect(new Response().toString()).to.equal('[object Response]');
		expect(new Request(base).toString()).to.equal('[object Request]');
	});

	it('should reject with error if url is protocol relative', () => {
		const url = '//example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, /Invalid URL/);
	});

	it('should reject with error if url is relative path', () => {
		const url = '/some/path';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, /Invalid URL/);
	});

	it('should reject with error if protocol is unsupported', () => {
		const url = 'ftp://example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, /URL scheme "ftp" is not supported/);
	});

	it('should reject with error on network failure', function () {
		this.timeout(5000);
		const url = 'http://localhost:50000/';
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.include({type: 'system', code: 'ECONNREFUSED', errno: 'ECONNREFUSED'});
	});

	it('error should contain system error if one occurred', () => {
		const err = new FetchError('a message', 'system', new Error('an error'));
		return expect(err).to.have.property('erroredSysCall');
	});

	it('error should not contain system error if none occurred', () => {
		const err = new FetchError('a message', 'a type');
		return expect(err).to.not.have.property('erroredSysCall');
	});

	it('system error is extracted from failed requests', function () {
		this.timeout(5000);
		const url = 'http://localhost:50000/';
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('erroredSysCall');
	});

	it('should resolve into response', async () => {
		const url = `${base}hello`;
		const res = await fetch(url);
		expect(res).to.be.an.instanceof(Response);
		expect(res.headers).to.be.an.instanceof(Headers);
		expect(res.body).to.be.an.instanceof(stream.Transform);
		expect(res.bodyUsed).to.be.false;

		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
		expect(res.statusText).to.equal('OK');
	});

	it('Response.redirect should resolve into response', () => {
		const res = Response.redirect('http://localhost');
		expect(res).to.be.an.instanceof(Response);
		expect(res.headers).to.be.an.instanceof(Headers);
		expect(res.headers.get('location')).to.equal('http://localhost/');
		expect(res.status).to.equal(302);
	});

	it('Response.redirect /w invalid url should fail', () => {
		expect(() => {
			Response.redirect('localhost');
		}).to.throw();
	});

	it('Response.redirect /w invalid status should fail', () => {
		expect(() => {
			Response.redirect('http://localhost', 200);
		}).to.throw();
	});

	it('should accept plain text response', async () => {
		const url = `${base}plain`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(res.bodyUsed).to.be.true;
		expect(result).to.be.a('string');
		expect(result).to.equal('text');
	});

	it('should accept html response (like plain text)', async () => {
		const url = `${base}html`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/html');
		const result = await res.text();
		expect(res.bodyUsed).to.be.true;
		expect(result).to.be.a('string');
		expect(result).to.equal('<html></html>');
	});

	it('should accept json response', async () => {
		const url = `${base}json`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('application/json');
		const result = await res.json();
		expect(res.bodyUsed).to.be.true;
		expect(result).to.be.an('object');
		expect(result).to.deep.equal({name: 'value'});
	});

	it('should send request with custom headers', async () => {
		const url = `${base}inspect`;
		const options = {
			headers: {'x-custom-header': 'abc'}
		};
		const res = await fetch(url, options);
		const result = await res.json();
		expect(result.headers['x-custom-header']).to.equal('abc');
	});

	it('should accept headers instance', async () => {
		const url = `${base}inspect`;
		const options = {
			headers: new Headers({'x-custom-header': 'abc'})
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.headers['x-custom-header']).to.equal('abc');
	});

	it('should accept custom host header', async () => {
		const url = `${base}inspect`;
		const options = {
			headers: {
				host: 'example.com'
			}
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.headers.host).to.equal('example.com');
	});

	it('should accept custom HoSt header', async () => {
		const url = `${base}inspect`;
		const options = {
			headers: {
				HoSt: 'example.com'
			}
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.headers.host).to.equal('example.com');
	});

	it('should follow redirect code 301', async () => {
		const url = `${base}redirect/301`;
		const res = await fetch(url);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		expect(res.ok).to.be.true;
		await res.arrayBuffer();
	});

	it('should follow redirect code 302', async () => {
		const url = `${base}redirect/302`;
		const res = await fetch(url);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should follow redirect code 303', async () => {
		const url = `${base}redirect/303`;
		const res = await fetch(url);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should follow redirect code 307', async () => {
		const url = `${base}redirect/307`;
		const res = await fetch(url);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should follow redirect code 308', async () => {
		const url = `${base}redirect/308`;
		const res = await fetch(url);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should follow redirect chain', async () => {
		const url = `${base}redirect/chain`;
		const res = await fetch(url);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should follow POST request redirect code 301 with GET', async () => {
		const url = `${base}redirect/301`;
		const options = {
			method: 'POST',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		const result = await res.json();
		expect(result.method).to.equal('GET');
		expect(result.body).to.equal('');
	});

	it('should follow PATCH request redirect code 301 with PATCH', async () => {
		const url = `${base}redirect/301`;
		const options = {
			method: 'PATCH',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		const json = await res.json();
		expect(json.method).to.equal('PATCH');
		expect(json.body).to.equal('a=1');
	});

	it('should follow POST request redirect code 302 with POST', async () => {
		const url = `${base}redirect/302`;
		const options = {
			method: 'POST',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		const result = await res.json();
		expect(result.method).to.equal('GET');
		expect(result.body).to.equal('');
	});

	it('should follow PATCH request redirect code 302 with PATCH', async () => {
		const url = `${base}redirect/302`;
		const options = {
			method: 'PATCH',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		const json = await res.json();
		expect(json.method).to.equal('PATCH');
		expect(json.body).to.equal('a=1');
	});

	it('should follow redirect code 303 with GET', async () => {
		const url = `${base}redirect/303`;
		const options = {
			method: 'PUT',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		const result = await res.json();
		expect(result.method).to.equal('GET');
		expect(result.body).to.equal('');
	});

	it('should follow PATCH request redirect code 307 with PATCH', async () => {
		const url = `${base}redirect/307`;
		const options = {
			method: 'PATCH',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		const result = await res.json();
		expect(result.method).to.equal('PATCH');
		expect(result.body).to.equal('a=1');
	});

	it('should not follow non-GET redirect if body is a readable stream', () => {
		const url = `${base}redirect/307`;
		const options = {
			method: 'PATCH',
			body: stream.Readable.from('tada')
		};
		return expect(fetch(url, options)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'unsupported-redirect');
	});

	it('should obey maximum redirect, reject case', () => {
		const url = `${base}redirect/chain`;
		const options = {
			follow: 1
		};
		return expect(fetch(url, options)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-redirect');
	});

	it('should obey redirect chain, resolve case', async () => {
		const url = `${base}redirect/chain`;
		const options = {
			follow: 2
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should allow not following redirect', () => {
		const url = `${base}redirect/301`;
		const options = {
			follow: 0
		};
		return expect(fetch(url, options)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-redirect');
	});

	it('should support redirect mode, manual flag', async () => {
		const url = `${base}redirect/301`;
		const options = {
			redirect: 'manual'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(url);
		expect(res.status).to.equal(301);
		expect(res.headers.get('location')).to.equal('/inspect');

		const locationURL = new URL(res.headers.get('location'), url);
		expect(locationURL.href).to.equal(`${base}inspect`);
	});

	it('should support redirect mode, manual flag, broken Location header', async () => {
		const url = `${base}redirect/bad-location`;
		const options = {
			redirect: 'manual'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(url);
		expect(res.status).to.equal(301);
		expect(res.headers.get('location')).to.equal('<>');

		const locationURL = new URL(res.headers.get('location'), url);
		expect(locationURL.href).to.equal(`${base}redirect/%3C%3E`);
		await res.arrayBuffer();
	});

	it('should support redirect mode to other host, manual flag', async () => {
		const url = `${base}redirect/301/otherhost`;
		const options = {
			redirect: 'manual'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(url);
		expect(res.status).to.equal(301);
		expect(res.headers.get('location')).to.equal('https://github.com/node-fetch');
	});

	it('should support redirect mode, error flag', () => {
		const url = `${base}redirect/301`;
		const options = {
			redirect: 'error'
		};
		return expect(fetch(url, options)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'no-redirect');
	});

	it('should support redirect mode, manual flag when there is no redirect', async () => {
		const url = `${base}hello`;
		const options = {
			redirect: 'manual'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(url);
		expect(res.status).to.equal(200);
		expect(res.headers.get('location')).to.be.null;
		await res.arrayBuffer();
	});

	it('should follow redirect code 301 and keep existing headers', async () => {
		const url = `${base}redirect/301`;
		const options = {
			headers: new Headers({'x-custom-header': 'abc'})
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(`${base}inspect`);
		const json = await res.json();
		expect(json.headers['x-custom-header']).to.equal('abc');
	});

	it('should not forward secure headers to 3th party', async () => {
		const res = await fetch(`${base}redirect-to/302/https://httpbin.org/get`, {
			headers: new Headers({
				cookie: 'gets=removed',
				cookie2: 'gets=removed',
				authorization: 'gets=removed',
				'www-authenticate': 'gets=removed',
				'other-safe-headers': 'stays',
				'x-foo': 'bar'
			})
		});

		const headers = new Headers((await res.json()).headers);
		// Safe headers are not removed
		expect(headers.get('other-safe-headers')).to.equal('stays');
		expect(headers.get('x-foo')).to.equal('bar');
		// Unsafe headers should not have been sent to httpbin
		expect(headers.get('cookie')).to.equal(null);
		expect(headers.get('cookie2')).to.equal(null);
		expect(headers.get('www-authenticate')).to.equal(null);
		expect(headers.get('authorization')).to.equal(null);
	});

	it('should forward secure headers to same host', async () => {
		const res = await fetch(`${base}redirect-to/302/${base}inspect`, {
			headers: new Headers({
				cookie: 'is=cookie',
				cookie2: 'is=cookie2',
				authorization: 'is=authorization',
				'other-safe-headers': 'stays',
				'www-authenticate': 'is=www-authenticate',
				'x-foo': 'bar'
			})
		});

		const headers = new Headers((await res.json()).headers);
		// Safe headers are not removed
		expect(res.url).to.equal(`${base}inspect`);
		expect(headers.get('other-safe-headers')).to.equal('stays');
		expect(headers.get('x-foo')).to.equal('bar');
		// Unsafe headers are not removed
		expect(headers.get('cookie')).to.equal('is=cookie');
		expect(headers.get('cookie2')).to.equal('is=cookie2');
		expect(headers.get('www-authenticate')).to.equal('is=www-authenticate');
		expect(headers.get('authorization')).to.equal('is=authorization');
	});

	it('isDomainOrSubdomain', () => {
		// Forwarding headers to same (sub)domain are OK
		expect(isDomainOrSubdomain('http://a.com', 'http://a.com')).to.be.true;
		expect(isDomainOrSubdomain('http://a.com', 'http://www.a.com')).to.be.true;
		expect(isDomainOrSubdomain('http://a.com', 'http://foo.bar.a.com')).to.be.true;

		// Forwarding headers to parent domain, another sibling or a totally other domain is not ok
		expect(isDomainOrSubdomain('http://b.com', 'http://a.com')).to.be.false;
		expect(isDomainOrSubdomain('http://www.a.com', 'http://a.com')).to.be.false;
		expect(isDomainOrSubdomain('http://bob.uk.com', 'http://uk.com')).to.be.false;
		expect(isDomainOrSubdomain('http://bob.uk.com', 'http://xyz.uk.com')).to.be.false;
	});

	it('should not forward secure headers to changed protocol', async () => {
		const res = await fetch('https://httpbin.org/redirect-to?url=http%3A%2F%2Fhttpbin.org%2Fget&status_code=302', {
			headers: new Headers({
				cookie: 'gets=removed',
				cookie2: 'gets=removed',
				authorization: 'gets=removed',
				'www-authenticate': 'gets=removed',
				'other-safe-headers': 'stays',
				'x-foo': 'bar'
			})
		});

		const headers = new Headers((await res.json()).headers);
		// Safe headers are not removed
		expect(headers.get('other-safe-headers')).to.equal('stays');
		expect(headers.get('x-foo')).to.equal('bar');
		// Unsafe headers should not have been sent to downgraded http
		expect(headers.get('cookie')).to.equal(null);
		expect(headers.get('cookie2')).to.equal(null);
		expect(headers.get('www-authenticate')).to.equal(null);
		expect(headers.get('authorization')).to.equal(null);
	});

	it('isSameProtocol', () => {
		// Forwarding headers to same protocol is OK
		expect(isSameProtocol('http://a.com', 'http://a.com')).to.be.true;
		expect(isSameProtocol('https://a.com', 'https://www.a.com')).to.be.true;

		// Forwarding headers to diff protocol is not OK
		expect(isSameProtocol('http://b.com', 'https://b.com')).to.be.false;
		expect(isSameProtocol('http://www.a.com', 'https://a.com')).to.be.false;
	});

	it('should treat broken redirect as ordinary response (follow)', async () => {
		const url = `${base}redirect/no-location`;
		const res = await fetch(url);
		expect(res.url).to.equal(url);
		expect(res.status).to.equal(301);
		expect(res.headers.get('location')).to.be.null;
		await res.arrayBuffer();
	});

	it('should treat broken redirect as ordinary response (manual)', async () => {
		const url = `${base}redirect/no-location`;
		const options = {
			redirect: 'manual'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(url);
		expect(res.status).to.equal(301);
		expect(res.headers.get('location')).to.be.null;
	});

	it('should process an invalid redirect (manual)', async () => {
		const url = `${base}redirect/301/invalid`;
		const options = {
			redirect: 'manual'
		};
		const res = await fetch(url, options);
		expect(res.url).to.equal(url);
		expect(res.status).to.equal(301);
		expect(res.headers.get('location')).to.equal('//super:invalid:url%/');
		await res.arrayBuffer();
	});

	it('should throw an error on invalid redirect url', async () => {
		const url = `${base}redirect/301/invalid`;
		return fetch(url).then(() => {
			expect.fail();
		}, error => {
			expect(error).to.be.an.instanceof(FetchError);
			expect(error.message).to.equal('uri requested responds with an invalid redirect URL: //super:invalid:url%/');
		});
	});

	it('should throw a TypeError on an invalid redirect option', () => {
		const url = `${base}redirect/301`;
		const options = {
			redirect: 'foobar'
		};
		return fetch(url, options).then(() => {
			expect.fail();
		}, error => {
			expect(error).to.be.an.instanceOf(TypeError);
			expect(error.message).to.equal('Redirect option \'foobar\' is not a valid value of RequestRedirect');
		});
	});

	it('should set redirected property on response when redirect', async () => {
		const url = `${base}redirect/301`;
		const res = await fetch(url);
		expect(res.redirected).to.be.true;
		await res.arrayBuffer();
	});

	it('should not set redirected property on response without redirect', async () => {
		const url = `${base}hello`;
		const res = await fetch(url);
		expect(res.redirected).to.be.false;
	});

	it('should ignore invalid headers', () => {
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
		expect(headers).to.be.instanceOf(Headers);
		expect(headers.raw()).to.deep.equal({});
	});

	it('should handle client-error response', async () => {
		const url = `${base}error/400`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		expect(res.status).to.equal(400);
		expect(res.statusText).to.equal('Bad Request');
		expect(res.ok).to.be.false;
		const result = await res.text();
		expect(res.bodyUsed).to.be.true;
		expect(result).to.be.a('string');
		expect(result).to.equal('client error');
	});

	it('should handle server-error response', async () => {
		const url = `${base}error/500`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		expect(res.status).to.equal(500);
		expect(res.statusText).to.equal('Internal Server Error');
		expect(res.ok).to.be.false;
		const result = await res.text();
		expect(res.bodyUsed).to.be.true;
		expect(result).to.be.a('string');
		expect(result).to.equal('server error');
	});

	it('should handle network-error response', () => {
		const url = `${base}error/reset`;
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code', 'ECONNRESET');
	});

	it('should handle network-error partial response', async () => {
		const url = `${base}error/premature`;
		const res = await fetch(url);
		expect(res.status).to.equal(200);
		expect(res.ok).to.be.true;
		await expect(res.text()).to.eventually.be.rejectedWith(Error)
			.and.have.property('message').matches(/Premature close|The operation was aborted|aborted/);
	});

	it('should handle network-error in chunked response', async () => {
		const url = `${base}error/premature/chunked`;
		const res = await fetch(url);
		expect(res.status).to.equal(200);
		expect(res.ok).to.be.true;

		return expect(new Promise((resolve, reject) => {
			res.body.on('error', reject);
			res.body.on('close', resolve);
		})).to.eventually.be.rejectedWith(Error, 'Premature close')
			.and.have.property('code', 'ERR_STREAM_PREMATURE_CLOSE');
	});

	it('should handle network-error in chunked response async iterator', async () => {
		const url = `${base}error/premature/chunked`;
		const res = await fetch(url);
		expect(res.status).to.equal(200);
		expect(res.ok).to.be.true;

		const read = async body => {
			const chunks = [];

			if (isNodeLowerThan('v14.15.2')) {
				// In older Node.js versions, some errors don't come out in the async iterator; we have
				// to pick them up from the event-emitter and then throw them after the async iterator
				let error;
				body.on('error', err => {
					error = err;
				});

				for await (const chunk of body) {
					chunks.push(chunk);
				}

				if (error) {
					throw error;
				}

				return new Promise(resolve => {
					body.on('close', () => resolve(chunks));
				});
			}

			for await (const chunk of body) {
				chunks.push(chunk);
			}

			return chunks;
		};

		return expect(read(res.body))
			.to.eventually.be.rejectedWith(Error, 'Premature close')
			.and.have.property('code', 'ERR_STREAM_PREMATURE_CLOSE');
	});

	it('should handle network-error in chunked response in consumeBody', async () => {
		const url = `${base}error/premature/chunked`;
		const res = await fetch(url);
		expect(res.status).to.equal(200);
		expect(res.ok).to.be.true;

		return expect(res.text())
			.to.eventually.be.rejectedWith(Error, 'Premature close');
	});

	it('should follow redirect after empty chunked transfer-encoding', async () => {
		const url = `${base}redirect/chunked`;
		const res = await fetch(url);
		expect(res.status).to.equal(200);
		expect(res.ok).to.be.true;
	});

	it('should handle chunked response with more than 1 chunk in the final packet', async () => {
		const url = `${base}chunked/multiple-ending`;
		const res = await fetch(url);
		expect(res.ok).to.be.true;

		const result = await res.text();
		expect(result).to.equal('foobar');
	});

	it('should handle chunked response with final chunk and EOM in separate packets', async () => {
		const url = `${base}chunked/split-ending`;
		const res = await fetch(url);
		expect(res.ok).to.be.true;
		const result = await res.text();
		expect(result).to.equal('foobar');
	});

	it('should handle DNS-error response', () => {
		const url = 'http://domain.invalid';
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code').that.matches(/ENOTFOUND|EAI_AGAIN/);
	});

	it('should reject invalid json response', async () => {
		const url = `${base}error/json`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('application/json');
		return expect(res.json()).to.eventually.be.rejectedWith(Error);
	});

	it('should handle response with no status text', async () => {
		const url = `${base}no-status-text`;
		const res = await fetch(url);
		expect(res.statusText).to.equal('');
		await res.arrayBuffer();
	});

	it('should handle no content response', async () => {
		const url = `${base}no-content`;
		const res = await fetch(url);
		expect(res.status).to.equal(204);
		expect(res.statusText).to.equal('No Content');
		expect(res.ok).to.be.true;
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.be.empty;
	});

	it('should reject when trying to parse no content response as json', async () => {
		const url = `${base}no-content`;
		const res = await fetch(url);
		expect(res.status).to.equal(204);
		expect(res.statusText).to.equal('No Content');
		expect(res.ok).to.be.true;
		return expect(res.json()).to.eventually.be.rejectedWith(Error);
	});

	it('should handle no content response with gzip encoding', async () => {
		const url = `${base}no-content/gzip`;
		const res = await fetch(url);
		expect(res.status).to.equal(204);
		expect(res.statusText).to.equal('No Content');
		expect(res.headers.get('content-encoding')).to.equal('gzip');
		expect(res.ok).to.be.true;
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.be.empty;
	});

	it('should handle not modified response', async () => {
		const url = `${base}not-modified`;
		const res = await fetch(url);
		expect(res.status).to.equal(304);
		expect(res.statusText).to.equal('Not Modified');
		expect(res.ok).to.be.false;
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.be.empty;
	});

	it('should handle not modified response with gzip encoding', async () => {
		const url = `${base}not-modified/gzip`;
		const res = await fetch(url);
		expect(res.status).to.equal(304);
		expect(res.statusText).to.equal('Not Modified');
		expect(res.headers.get('content-encoding')).to.equal('gzip');
		expect(res.ok).to.be.false;
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.be.empty;
	});

	it('should decompress gzip response', async () => {
		const url = `${base}gzip`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.equal('hello world');
	});

	it('should decompress slightly invalid gzip response', async () => {
		const url = `${base}gzip-truncated`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.equal('hello world');
	});

	it('should make capitalised Content-Encoding lowercase', async () => {
		const url = `${base}gzip-capital`;
		const res = await fetch(url);
		expect(res.headers.get('content-encoding')).to.equal('gzip');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.equal('hello world');
	});

	it('should decompress deflate response', async () => {
		const url = `${base}deflate`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.equal('hello world');
	});

	it('should decompress deflate raw response from old apache server', async () => {
		const url = `${base}deflate-raw`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.equal('hello world');
	});

	it('should handle empty deflate response', async () => {
		const url = `${base}empty/deflate`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const text = await res.text();
		expect(text).to.be.a('string');
		expect(text).to.be.empty;
	});

	it('should decompress brotli response', async function () {
		if (typeof zlib.createBrotliDecompress !== 'function') {
			this.skip();
		}

		const url = `${base}brotli`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.equal('hello world');
	});

	it('should handle no content response with brotli encoding', async function () {
		if (typeof zlib.createBrotliDecompress !== 'function') {
			this.skip();
		}

		const url = `${base}no-content/brotli`;
		const res = await fetch(url);
		expect(res.status).to.equal(204);
		expect(res.statusText).to.equal('No Content');
		expect(res.headers.get('content-encoding')).to.equal('br');
		expect(res.ok).to.be.true;
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.be.empty;
	});

	it('should skip decompression if unsupported', async () => {
		const url = `${base}sdch`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.equal('fake sdch string');
	});

	it('should reject if response compression is invalid', async () => {
		const url = `${base}invalid-content-encoding`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		return expect(res.text()).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code', 'Z_DATA_ERROR');
	});

	it('should handle errors on the body stream even if it is not used', done => {
		const url = `${base}invalid-content-encoding`;
		fetch(url)
			.then(res => {
				expect(res.status).to.equal(200);
			})
			.catch(() => {})
			.then(() => {
				// Wait a few ms to see if a uncaught error occurs
				setTimeout(() => {
					done();
				}, 20);
			});
	});

	it('should collect handled errors on the body stream to reject if the body is used later', async () => {
		const url = `${base}invalid-content-encoding`;
		const res = await fetch(url);
		await new Promise(resolve => {
			setTimeout(() => resolve(), 20);
		});
		expect(res.headers.get('content-type')).to.equal('text/plain');
		return expect(res.text()).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code', 'Z_DATA_ERROR');
	});

	it('should allow disabling auto decompression', async () => {
		const url = `${base}gzip`;
		const options = {
			compress: false
		};
		const res = await fetch(url, options);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		const result = await res.text();
		expect(result).to.be.a('string');
		expect(result).to.not.equal('hello world');
	});

	it('should not overwrite existing accept-encoding header when auto decompression is true', async () => {
		const url = `${base}inspect`;
		const options = {
			compress: true,
			headers: {
				'Accept-Encoding': 'gzip'
			}
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.headers['accept-encoding']).to.equal('gzip');
	});

	const testAbortController = (name, buildAbortController, moreTests = null) => {
		describe(`AbortController (${name})`, () => {
			let controller;

			beforeEach(() => {
				controller = buildAbortController();
			});

			it('should support request cancellation with signal', () => {
				const promise = fetch(`${base}timeout`, {
					method: 'POST',
					signal: controller.signal,
					headers: {
						'Content-Type': 'application/json',
						body: '{"hello": "world"}'
					}
				});

				controller.abort();

				return expect(promise)
					.to.eventually.be.rejected
					.and.be.an.instanceOf(Error)
					.and.include({
						type: 'aborted',
						name: 'AbortError'
					});
			});

			it('should support multiple request cancellation with signal', () => {
				const fetches = [
					fetch(`${base}timeout`, {signal: controller.signal}),
					fetch(`${base}timeout`, {
						method: 'POST',
						signal: controller.signal,
						headers: {
							'Content-Type': 'application/json',
							body: JSON.stringify({hello: 'world'})
						}
					})
				];

				controller.abort();

				return Promise.all(fetches.map(fetched => expect(fetched)
					.to.eventually.be.rejected
					.and.be.an.instanceOf(Error)
					.and.include({
						type: 'aborted',
						name: 'AbortError'
					})
				));
			});

			it('should reject immediately if signal has already been aborted', () => {
				const url = `${base}timeout`;
				const options = {
					signal: controller.signal
				};
				controller.abort();
				const fetched = fetch(url, options);
				return expect(fetched).to.eventually.be.rejected
					.and.be.an.instanceOf(Error)
					.and.include({
						type: 'aborted',
						name: 'AbortError'
					});
			});

			it('should allow redirects to be aborted', () => {
				const request = new Request(`${base}redirect/slow`, {
					signal: controller.signal
				});
				setTimeout(() => {
					controller.abort();
				}, 20);
				return expect(fetch(request)).to.be.eventually.rejected
					.and.be.an.instanceOf(Error)
					.and.have.property('name', 'AbortError');
			});

			it('should allow redirected response body to be aborted', async () => {
				const request = new Request(`${base}redirect/slow-stream`, {
					signal: controller.signal
				});
				const res = await fetch(request);
				expect(res.headers.get('content-type')).to.equal('text/plain');
				controller.abort();
				return expect(res.text()).to.be.eventually.rejected
					.and.be.an.instanceOf(Error)
					.and.have.property('name', 'AbortError');
			});

			it('should reject response body with AbortError when aborted before stream has been read completely', () => {
				return expect(fetch(
					`${base}slow`,
					{signal: controller.signal}
				))
					.to.eventually.be.fulfilled
					.then(res => {
						const promise = res.text();
						controller.abort();
						return expect(promise)
							.to.eventually.be.rejected
							.and.be.an.instanceof(Error)
							.and.have.property('name', 'AbortError');
					});
			});

			it('should reject response body methods immediately with AbortError when aborted before stream is disturbed', () => {
				return expect(fetch(
					`${base}slow`,
					{signal: controller.signal}
				))
					.to.eventually.be.fulfilled
					.then(res => {
						controller.abort();
						return expect(res.text())
							.to.eventually.be.rejected
							.and.be.an.instanceof(Error)
							.and.have.property('name', 'AbortError');
					});
			});

			it('should emit error event to response body with an AbortError when aborted before underlying stream is closed', done => {
				expect(fetch(
					`${base}slow`,
					{signal: controller.signal}
				))
					.to.eventually.be.fulfilled
					.then(res => {
						res.body.once('error', err => {
							expect(err)
								.to.be.an.instanceof(Error)
								.and.have.property('name', 'AbortError');
							done();
						});
						controller.abort();
					});
			});

			it('should cancel request body of type Stream with AbortError when aborted', () => {
				const body = new stream.Readable({objectMode: true});
				body._read = () => {};
				const promise = fetch(`${base}slow`, {
					method: 'POST',
					signal: controller.signal,
					body
				});

				const result = Promise.all([
					new Promise((resolve, reject) => {
						body.on('error', error => {
							try {
								expect(error).to.be.an.instanceof(Error).and.have.property('name', 'AbortError');
								resolve();
							} catch (error_) {
								reject(error_);
							}
						});
					}),
					expect(promise).to.eventually.be.rejected
						.and.be.an.instanceof(Error)
						.and.have.property('name', 'AbortError')
				]);

				controller.abort();

				return result;
			});

			if (moreTests) {
				moreTests();
			}
		});
	};

	testAbortController('polyfill',
		() => new AbortControllerPolyfill(),
		() => {
			it('should remove internal AbortSignal event listener after request is aborted', () => {
				const controller = new AbortControllerPolyfill();
				const {signal} = controller;

				setTimeout(() => {
					controller.abort();
				}, 20);

				return expect(fetch(`${base}timeout`, {signal}))
					.to.eventually.be.rejected
					.and.be.an.instanceof(Error)
					.and.have.property('name', 'AbortError')
					.then(() => {
						return expect(signal.listeners.abort.length).to.equal(0);
					});
			});

			it('should remove internal AbortSignal event listener after request and response complete without aborting', () => {
				const controller = new AbortControllerPolyfill();
				const {signal} = controller;
				const fetchHtml = fetch(`${base}html`, {signal})
					.then(res => res.text());
				const fetchResponseError = fetch(`${base}error/reset`, {signal});
				const fetchRedirect = fetch(`${base}redirect/301`, {signal}).then(res => res.json());
				return Promise.all([
					expect(fetchHtml).to.eventually.be.fulfilled.and.equal('<html></html>'),
					expect(fetchResponseError).to.be.eventually.rejected,
					expect(fetchRedirect).to.eventually.be.fulfilled
				]).then(() => {
					expect(signal.listeners.abort.length).to.equal(0);
				});
			});
		}
	);

	testAbortController('mysticatea', () => new AbortControllerMysticatea());

	if (process.version > 'v15') {
		testAbortController('native', () => new AbortController());
	}

	it('should throw a TypeError if a signal is not of type AbortSignal or EventTarget', () => {
		return Promise.all([
			expect(fetch(`${base}inspect`, {signal: {}}))
				.to.be.eventually.rejected
				.and.be.an.instanceof(TypeError)
				.and.have.property('message').includes('AbortSignal'),
			expect(fetch(`${base}inspect`, {signal: ''}))
				.to.be.eventually.rejected
				.and.be.an.instanceof(TypeError)
				.and.have.property('message').includes('AbortSignal'),
			expect(fetch(`${base}inspect`, {signal: Object.create(null)}))
				.to.be.eventually.rejected
				.and.be.an.instanceof(TypeError)
				.and.have.property('message').includes('AbortSignal')
		]);
	});

	it('should gracefully handle a nullish signal', () => {
		return Promise.all([
			fetch(`${base}hello`, {signal: null}).then(res => {
				return expect(res.ok).to.be.true;
			}),
			fetch(`${base}hello`, {signal: undefined}).then(res => {
				return expect(res.ok).to.be.true;
			})
		]);
	});

	it('should set default User-Agent', () => {
		const url = `${base}inspect`;
		return fetch(url).then(res => res.json()).then(res => {
			expect(res.headers['user-agent']).to.startWith('node-fetch');
		});
	});

	it('should allow setting User-Agent', () => {
		const url = `${base}inspect`;
		const options = {
			headers: {
				'user-agent': 'faked'
			}
		};
		return fetch(url, options).then(res => res.json()).then(res => {
			expect(res.headers['user-agent']).to.equal('faked');
		});
	});

	it('should set default Accept header', async () => {
		const url = `${base}inspect`;
		const res = await fetch(url);
		const json = await res.json();
		expect(json.headers.accept).to.equal('*/*');
	});

	it('should allow setting Accept header', async () => {
		const url = `${base}inspect`;
		const options = {
			headers: {
				accept: 'application/json'
			}
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.headers.accept).to.equal('application/json');
	});

	it('should allow POST request', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST'
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('0');
	});

	it('should allow POST request with string body', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('a=1');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.equal('text/plain;charset=UTF-8');
		expect(json.headers['content-length']).to.equal('3');
	});

	it('should allow POST request with ArrayBuffer body', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: encoder.encode('Hello, world!\n').buffer
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('Hello, world!\n');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('14');
	});

	it('should allow POST request with ArrayBuffer body from a VM context', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: new VMUint8Array(encoder.encode('Hello, world!\n')).buffer
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('Hello, world!\n');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('14');
	});

	it('should allow POST request with ArrayBufferView (Uint8Array) body', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: encoder.encode('Hello, world!\n')
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('Hello, world!\n');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('14');
	});

	it('should allow POST request with ArrayBufferView (DataView) body', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: new DataView(encoder.encode('Hello, world!\n').buffer)
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('Hello, world!\n');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('14');
	});

	it('should allow POST request with ArrayBufferView (Uint8Array) body from a VM context', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: new VMUint8Array(encoder.encode('Hello, world!\n'))
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('Hello, world!\n');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('14');
	});

	it('should allow POST request with ArrayBufferView (Uint8Array, offset, length) body', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: encoder.encode('Hello, world!\n').subarray(7, 13)
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('world!');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('6');
	});

	it('should allow POST request with blob body without type', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: new Blob(['a=1'])
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('a=1');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('3');
	});

	it('should allow POST request with blob body with type', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: new Blob(['a=1'], {
				type: 'text/plain;charset=UTF-8'
			})
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('a=1');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.equal('text/plain;charset=UTF-8');
		expect(json.headers['content-length']).to.equal('3');
	});

	it('should allow POST request with readable stream as body', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: stream.Readable.from('a=1')
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('a=1');
		expect(json.headers['transfer-encoding']).to.equal('chunked');
		expect(json.headers['content-type']).to.be.undefined;
		expect(json.headers['content-length']).to.be.undefined;
	});

	it('should reject if the request body stream emits an error', () => {
		const url = `${base}inspect`;
		const requestBody = new stream.PassThrough();
		const options = {
			method: 'POST',
			body: requestBody
		};
		const errorMessage = 'request body stream error';
		setImmediate(() => {
			requestBody.emit('error', new Error(errorMessage));
		});
		return expect(fetch(url, options))
			.to.be.rejectedWith(Error, errorMessage);
	});

	it('should allow POST request with form-data as body', async () => {
		const form = new FormData();
		form.append('a', '1');

		const url = `${base}multipart`;
		const options = {
			method: 'POST',
			body: form
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['content-type']).to.startWith('multipart/form-data;boundary=');
		expect(json.headers['content-length']).to.be.a('string');
		expect(json.body).to.equal('a=1');
	});

	it('should allow POST request with form-data using stream as body', async () => {
		const form = new FormData();
		form.append('my_field', fs.createReadStream('test/utils/dummy.txt'));

		const url = `${base}multipart`;
		const options = {
			method: 'POST',
			body: form
		};

		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['content-type']).to.startWith('multipart/form-data;boundary=');
		expect(json.headers['content-length']).to.be.undefined;
		expect(json.body).to.contain('my_field=');
	});

	it('should allow POST request with form-data as body and custom headers', async () => {
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
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['content-type']).to.startWith('multipart/form-data; boundary=');
		expect(json.headers['content-length']).to.be.a('string');
		expect(json.headers.b).to.equal('2');
		expect(json.body).to.equal('a=1');
	});

	it('should support spec-compliant form-data as POST body', async () => {
		const form = new FormDataNode();

		const filename = path.join('test', 'utils', 'dummy.txt');

		form.set('field', 'some text');
		form.set('file', fileFromSync(filename));

		const url = `${base}multipart`;
		const options = {
			method: 'POST',
			body: form
		};

		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['content-type']).to.startWith('multipart/form-data');
		expect(json.body).to.contain('field=');
		expect(json.body).to.contain('file=');
	});

	it('should allow POST request with object body', async () => {
		const url = `${base}inspect`;
		// Note that fetch simply calls tostring on an object
		const options = {
			method: 'POST',
			body: {a: 1}
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('[object Object]');
		expect(json.headers['content-type']).to.equal('text/plain;charset=UTF-8');
		expect(json.headers['content-length']).to.equal('15');
	});

	it('constructing a Response with URLSearchParams as body should have a Content-Type', async () => {
		const parameters = new URLSearchParams();
		const res = new Response(parameters);
		res.headers.get('Content-Type');
		expect(res.headers.get('Content-Type')).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
	});

	it('constructing a Request with URLSearchParams as body should have a Content-Type', async () => {
		const parameters = new URLSearchParams();
		const request = new Request(base, {method: 'POST', body: parameters});
		expect(request.headers.get('Content-Type')).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
	});

	it('Reading a body with URLSearchParams should echo back the result', async () => {
		const parameters = new URLSearchParams();
		parameters.append('a', '1');
		const text = await new Response(parameters).text();
		expect(text).to.equal('a=1');
	});

	// Body should been cloned...
	it('constructing a Request/Response with URLSearchParams and mutating it should not affected body', async () => {
		const parameters = new URLSearchParams();
		const request = new Request(`${base}inspect`, {method: 'POST', body: parameters});
		parameters.append('a', '1');
		const text = await request.text();
		expect(text).to.equal('');
	});

	it('should allow POST request with URLSearchParams as body', async () => {
		const parameters = new URLSearchParams();
		parameters.append('a', '1');

		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: parameters
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
		expect(json.headers['content-length']).to.equal('3');
		expect(json.body).to.equal('a=1');
	});

	it('should still recognize URLSearchParams when extended', async () => {
		class CustomSearchParameters extends URLSearchParams {}
		const parameters = new CustomSearchParameters();
		parameters.append('a', '1');

		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: parameters
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
		expect(json.headers['content-length']).to.equal('3');
		expect(json.body).to.equal('a=1');
	});

	/* For 100% code coverage, checks for duck-typing-only detection
	 * where both constructor.name and brand tests fail */
	it('should still recognize URLSearchParams when extended from polyfill', async () => {
		class CustomPolyfilledSearchParameters extends URLSearchParams {}
		const parameters = new CustomPolyfilledSearchParameters();
		parameters.append('a', '1');

		const url = `${base}inspect`;
		const options = {
			method: 'POST',
			body: parameters
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
		expect(json.headers['content-length']).to.equal('3');
		expect(json.body).to.equal('a=1');
	});

	it('should overwrite Content-Length if possible', async () => {
		const url = `${base}inspect`;
		// Note that fetch simply calls tostring on an object
		const options = {
			method: 'POST',
			headers: {
				'Content-Length': '1000'
			},
			body: 'a=1'
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('POST');
		expect(json.body).to.equal('a=1');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-type']).to.equal('text/plain;charset=UTF-8');
		expect(json.headers['content-length']).to.equal('3');
	});

	it('should allow PUT request', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'PUT',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('PUT');
		expect(json.body).to.equal('a=1');
	});

	it('should allow DELETE request', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'DELETE'
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('DELETE');
	});

	it('should allow DELETE request with string body', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'DELETE',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('DELETE');
		expect(json.body).to.equal('a=1');
		expect(json.headers['transfer-encoding']).to.be.undefined;
		expect(json.headers['content-length']).to.equal('3');
	});

	it('should allow PATCH request', async () => {
		const url = `${base}inspect`;
		const options = {
			method: 'PATCH',
			body: 'a=1'
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.method).to.equal('PATCH');
		expect(json.body).to.equal('a=1');
	});

	it('should allow HEAD request', async () => {
		const url = `${base}hello`;
		const options = {
			method: 'HEAD'
		};
		const res = await fetch(url, options);
		const text = await res.text();
		expect(res.status).to.equal(200);
		expect(res.statusText).to.equal('OK');
		expect(res.headers.get('content-type')).to.equal('text/plain');
		expect(res.body).to.be.an.instanceof(stream.Transform);
		expect(text).to.equal('');
	});

	it('should allow HEAD request with content-encoding header', async () => {
		const url = `${base}error/404`;
		const options = {
			method: 'HEAD'
		};
		const res = await fetch(url, options);
		const text = await res.text();
		expect(res.status).to.equal(404);
		expect(res.headers.get('content-encoding')).to.equal('gzip');
		expect(text).to.equal('');
	});

	it('should allow OPTIONS request', async () => {
		const url = `${base}options`;
		const options = {
			method: 'OPTIONS'
		};
		const res = await fetch(url, options);
		expect(res.status).to.equal(200);
		expect(res.statusText).to.equal('OK');
		expect(res.headers.get('allow')).to.equal('GET, HEAD, OPTIONS');
		expect(res.body).to.be.an.instanceof(stream.Transform);
		await res.arrayBuffer();
	});

	it('should reject decoding body twice', async () => {
		const url = `${base}plain`;
		const res = await fetch(url);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		await res.text();
		expect(res.bodyUsed).to.be.true;
		return expect(res.text()).to.eventually.be.rejectedWith(Error);
	});

	it('should support maximum response size, multiple chunk', async () => {
		const url = `${base}size/chunk`;
		const options = {
			size: 5
		};
		const res = await fetch(url, options);
		expect(res.status).to.equal(200);
		expect(res.headers.get('content-type')).to.equal('text/plain');
		return expect(res.text()).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-size');
	});

	it('should support maximum response size, single chunk', async () => {
		const url = `${base}size/long`;
		const options = {
			size: 5
		};
		const res = await fetch(url, options);
		expect(res.status).to.equal(200);
		expect(res.headers.get('content-type')).to.equal('text/plain');

		return expect(res.text()).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-size');
	});

	it('should allow piping response body as stream', async () => {
		const url = `${base}hello`;
		const res = await fetch(url);
		expect(res.body).to.be.an.instanceof(stream.Transform);
		const body = await text(res.body);
		expect(body).to.equal('world');
	});

	it('should allow cloning a response, and use both as stream', async () => {
		const url = `${base}hello`;
		const res = await fetch(url);
		const r1 = res.clone();
		expect(res.body).to.be.an.instanceof(stream.Transform);
		expect(r1.body).to.be.an.instanceof(stream.Transform);

		const [t1, t2] = await Promise.all([
			text(res.body),
			text(r1.body)
		]);

		expect(t1).to.equal('world');
		expect(t2).to.equal('world');
	});

	it('should allow cloning a json response and log it as text response', async () => {
		const url = `${base}json`;
		const res = await fetch(url);
		const r1 = res.clone();
		const results = await Promise.all([res.json(), r1.text()]);
		expect(results[0]).to.deep.equal({name: 'value'});
		expect(results[1]).to.equal('{"name":"value"}');
	});

	it('should allow cloning a json response, and then log it as text response', async () => {
		const url = `${base}json`;
		const res = await fetch(url);
		const r1 = res.clone();
		const json = await res.json();
		expect(json).to.deep.equal({name: 'value'});
		const text = await r1.text();
		expect(text).to.equal('{"name":"value"}');
	});

	it('should allow cloning a json response, first log as text response, then return json object', async () => {
		const url = `${base}json`;
		const res = await fetch(url);
		const r1 = res.clone();
		const text = await r1.text();
		expect(text).to.equal('{"name":"value"}');
		const json = await res.json();
		expect(json).to.deep.equal({name: 'value'});
	});

	it('should not allow cloning a response after its been used', async () => {
		const url = `${base}hello`;
		const res = await fetch(url);
		await res.text();
		expect(() => {
			res.clone();
		}).to.throw(Error);
	});

	it('the default highWaterMark should equal 16384', async () => {
		const url = `${base}hello`;
		const res = await fetch(url);
		expect(res.highWaterMark).to.equal(16384);
	});

	it('should timeout on cloning response without consuming one of the streams when the second packet size is equal default highWaterMark', function () {
		this.timeout(300);
		const url = local.mockResponse(res => {
			// Observed behavior of TCP packets splitting:
			// - response body size <= 65438 → single packet sent
			// - response body size  > 65438 → multiple packets sent
			// Max TCP packet size is 64kB (https://stackoverflow.com/a/2614188/5763764),
			// but first packet probably transfers more than the response body.
			const firstPacketMaxSize = 65438;
			const secondPacketSize = 16 * 1024; // = defaultHighWaterMark
			res.end(crypto.randomBytes(firstPacketMaxSize + secondPacketSize));
		});
		return expect(
			fetch(url).then(res => res.clone().buffer())
		).to.timeout;
	});

	it('should timeout on cloning response without consuming one of the streams when the second packet size is equal custom highWaterMark', function () {
		this.timeout(300);
		const url = local.mockResponse(res => {
			const firstPacketMaxSize = 65438;
			const secondPacketSize = 10;
			res.end(crypto.randomBytes(firstPacketMaxSize + secondPacketSize));
		});
		return expect(
			fetch(url, {highWaterMark: 10}).then(res => res.clone().buffer())
		).to.timeout;
	});

	it('should not timeout on cloning response without consuming one of the streams when the second packet size is less than default highWaterMark', function () {
		// TODO: fix test.
		if (!isNodeLowerThan('v16.0.0')) {
			this.skip();
		}

		this.timeout(300);
		const url = local.mockResponse(res => {
			const firstPacketMaxSize = 65438;
			const secondPacketSize = 16 * 1024; // = defaultHighWaterMark
			res.end(crypto.randomBytes(firstPacketMaxSize + secondPacketSize - 1));
		});
		return expect(
			fetch(url).then(res => res.clone().buffer())
		).not.to.timeout;
	});

	it('should not timeout on cloning response without consuming one of the streams when the second packet size is less than custom highWaterMark', function () {
		// TODO: fix test.
		if (!isNodeLowerThan('v16.0.0')) {
			this.skip();
		}

		this.timeout(300);
		const url = local.mockResponse(res => {
			const firstPacketMaxSize = 65438;
			const secondPacketSize = 10;
			res.end(crypto.randomBytes(firstPacketMaxSize + secondPacketSize - 1));
		});
		return expect(
			fetch(url, {highWaterMark: 10}).then(res => res.clone().buffer())
		).not.to.timeout;
	});

	it('should not timeout on cloning response without consuming one of the streams when the response size is double the custom large highWaterMark - 1', function () {
		// TODO: fix test.
		if (!isNodeLowerThan('v16.0.0')) {
			this.skip();
		}

		this.timeout(300);
		const url = local.mockResponse(res => {
			res.end(crypto.randomBytes((2 * 512 * 1024) - 1));
		});
		return expect(
			fetch(url, {highWaterMark: 512 * 1024}).then(res => res.clone().buffer())
		).not.to.timeout;
	});

	it('should allow get all responses of a header', () => {
		const url = `${base}cookie`;
		return fetch(url).then(res => {
			const expected = 'a=1, b=1';
			expect(res.headers.get('set-cookie')).to.equal(expected);
			expect(res.headers.get('Set-Cookie')).to.equal(expected);
		});
	});

	it('should return all headers using raw()', async () => {
		const url = `${base}cookie`;
		const res = await fetch(url);
		const expected = [
			'a=1',
			'b=1'
		];
		expect(res.headers.raw()['set-cookie']).to.deep.equal(expected);
	});

	it('should allow deleting header', () => {
		const url = `${base}cookie`;
		return fetch(url).then(res => {
			res.headers.delete('set-cookie');
			expect(res.headers.get('set-cookie')).to.be.null;
		});
	});

	it('should send request with connection keep-alive if agent is provided', async () => {
		const url = `${base}inspect`;
		const options = {
			agent: new http.Agent({
				keepAlive: true
			})
		};
		const res = await fetch(url, options);
		const json = await res.json();
		expect(json.headers.connection).to.equal('keep-alive');
	});

	it('should support fetch with Request instance', async () => {
		const url = `${base}hello`;
		const request = new Request(url);
		const res = await fetch(request);
		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should support fetch with Node.js URL object', async () => {
		const url = `${base}hello`;
		const urlObject = new URL(url);
		const request = new Request(urlObject);
		const res = await fetch(request);
		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('should support fetch with WHATWG URL object', async () => {
		const url = `${base}hello`;
		const urlObject = new URL(url);
		const request = new Request(urlObject);
		const res = await fetch(request);
		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
	});

	it('should keep `?` sign in URL when no params are given', async () => {
		const url = `${base}question?`;
		const urlObject = new URL(url);
		const request = new Request(urlObject);
		const res = await fetch(request);
		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
		await res.arrayBuffer();
	});

	it('if params are given, do not modify anything', async () => {
		const url = `${base}question?a=1`;
		const urlObject = new URL(url);
		const request = new Request(urlObject);
		const res = await fetch(request);
		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
	});

	it('should preserve the hash (#) symbol', async () => {
		const url = `${base}question?#`;
		const urlObject = new URL(url);
		const request = new Request(urlObject);
		const res = await fetch(request);
		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
	});

	it('should support reading blob as text', async () => {
		const res = new Response('hello');
		const blob = await res.blob();
		const text = await blob.text();
		expect(text).to.equal('hello');
	});

	it('should support reading blob as arrayBuffer', async () => {
		const res = await new Response('hello');
		const blob = await res.blob();
		const arrayBuffer = await blob.arrayBuffer();
		const string = String.fromCharCode.apply(null, new Uint8Array(arrayBuffer));
		expect(string).to.equal('hello');
	});

	it('should support reading blob as stream', async () => {
		const blob = await new Response('hello').blob();
		const str = await text(blob.stream());
		expect(str).to.equal('hello');
	});

	it('should support blob round-trip', async () => {
		const helloUrl = `${base}hello`;
		const helloRes = await fetch(helloUrl);
		const helloBlob = await helloRes.blob();
		const inspectUrl = `${base}inspect`;
		const {size, type} = helloBlob;
		const inspectRes = await fetch(inspectUrl, {
			method: 'POST',
			body: helloBlob
		});
		const {body, headers} = await inspectRes.json();
		expect(body).to.equal('world');
		expect(headers['content-type']).to.equal(type);
		expect(headers['content-length']).to.equal(String(size));
	});

	it('should support overwrite Request instance', async () => {
		const url = `${base}inspect`;
		const request = new Request(url, {
			method: 'POST',
			headers: {
				a: '1'
			}
		});
		const res = await fetch(request, {
			method: 'GET',
			headers: {
				a: '2'
			}
		});
		const {method, headers} = await res.json();
		expect(method).to.equal('GET');
		expect(headers.a).to.equal('2');
	});

	it('should support arrayBuffer(), blob(), text(), json() and buffer() method in Body constructor', () => {
		const body = new Body('a=1');
		expect(body).to.have.property('arrayBuffer');
		expect(body).to.have.property('blob');
		expect(body).to.have.property('text');
		expect(body).to.have.property('json');
		expect(body).to.have.property('buffer');
	});

	/* eslint-disable-next-line func-names */
	it('should create custom FetchError', function funcName() {
		const systemError = new Error('system');
		systemError.code = 'ESOMEERROR';

		const err = new FetchError('test message', 'test-error', systemError);
		expect(err).to.be.an.instanceof(Error);
		expect(err).to.be.an.instanceof(FetchError);
		expect(err.name).to.equal('FetchError');
		expect(err.message).to.equal('test message');
		expect(err.type).to.equal('test-error');
		expect(err.code).to.equal('ESOMEERROR');
		expect(err.errno).to.equal('ESOMEERROR');
		// Reading the stack is quite slow (~30-50ms)
		expect(err.stack).to.include('funcName').and.to.startWith(`${err.name}: ${err.message}`);
	});

	it('should support https request', async function () {
		this.timeout(5000);
		const url = 'https://github.com/';
		const options = {
			method: 'HEAD'
		};
		const res = await fetch(url, options);
		expect(res.status).to.equal(200);
		expect(res.ok).to.be.true;
	});

	// Issue #414
	it('should reject if attempt to accumulate body stream throws', () => {
		const res = new Response(stream.Readable.from((async function * () {
			yield encoder.encode('tada');
			await new Promise(resolve => {
				setTimeout(resolve, 200);
			});
			yield {tada: 'yes'};
		})()));

		return expect(res.text()).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.include({type: 'system'})
			.and.have.property('message').that.include('Could not create Buffer');
	});

	it('supports supplying a lookup function to the agent', () => {
		const url = `${base}redirect/301`;
		let called = 0;
		function lookupSpy(hostname, options, callback) {
			called++;

			return lookup(hostname, options, callback);
		}

		const agent = http.Agent({lookup: lookupSpy});
		return fetch(url, {agent}).then(() => {
			expect(called).to.equal(2);
		});
	});

	it('supports supplying a famliy option to the agent', async () => {
		const url = `${base}redirect/301`;
		const families = [];
		const family = Symbol('family');
		function lookupSpy(hostname, options, callback) {
			families.push(options.family);

			return lookup(hostname, {}, callback);
		}

		const agent = new http.Agent({lookup: lookupSpy, family});
		const res = await fetch(url, {agent});
		expect(families).to.have.length(2);
		expect(families[0]).to.equal(family);
		expect(families[1]).to.equal(family);
		await res.arrayBuffer();
	});

	it('should allow a function supplying the agent', async () => {
		const url = `${base}inspect`;

		const agent = new http.Agent({
			keepAlive: true
		});

		let parsedURL;

		const res = await fetch(url, {
			agent(_parsedURL) {
				parsedURL = _parsedURL;
				return agent;
			}
		});
		const json = await res.json();
		// The agent provider should have been called
		expect(parsedURL.protocol).to.equal('http:');
		// The agent we returned should have been used
		expect(json.headers.connection).to.equal('keep-alive');
	});

	it('should calculate content length and extract content type for each body type', () => {
		const url = `${base}hello`;
		const bodyContent = 'a=1';

		const streamBody = stream.Readable.from(bodyContent);
		const streamRequest = new Request(url, {
			method: 'POST',
			body: streamBody,
			size: 1024
		});

		const blobBody = new Blob([bodyContent], {type: 'text/plain'});
		const blobRequest = new Request(url, {
			method: 'POST',
			body: blobBody,
			size: 1024
		});

		const formBody = new FormData();
		formBody.append('a', '1');
		const formRequest = new Request(url, {
			method: 'POST',
			body: formBody,
			size: 1024
		});

		const bufferBody = encoder.encode(bodyContent);
		const bufferRequest = new Request(url, {
			method: 'POST',
			body: bufferBody,
			size: 1024
		});

		const stringRequest = new Request(url, {
			method: 'POST',
			body: bodyContent,
			size: 1024
		});

		const nullRequest = new Request(url, {
			method: 'GET',
			body: null,
			size: 1024
		});

		expect(getTotalBytes(streamRequest)).to.be.null;
		expect(getTotalBytes(blobRequest)).to.equal(blobBody.size);
		expect(getTotalBytes(formRequest)).to.not.be.null;
		expect(getTotalBytes(bufferRequest)).to.equal(bufferBody.length);
		expect(getTotalBytes(stringRequest)).to.equal(bodyContent.length);
		expect(getTotalBytes(nullRequest)).to.equal(0);

		expect(extractContentType(streamBody)).to.be.null;
		expect(extractContentType(blobBody)).to.equal('text/plain');
		expect(extractContentType(formBody)).to.startWith('multipart/form-data');
		expect(extractContentType(bufferBody)).to.be.null;
		expect(extractContentType(bodyContent)).to.equal('text/plain;charset=UTF-8');
		expect(extractContentType(null)).to.be.null;
	});

	it('should encode URLs as UTF-8', async () => {
		const url = `${base}möbius`;
		const res = await fetch(url);
		expect(res.url).to.equal(`${base}m%C3%B6bius`);
	});

	it('static Response.json should work', async () => {
		const response = Response.json({foo: 'bar'});
		expect(response.status).to.equal(200);
		expect(response.headers.get('content-type')).to.equal('application/json');
		expect(await response.text()).to.equal(JSON.stringify({foo: 'bar'}));

		const response1 = Response.json(null, {
			status: 301,
			statusText: 'node-fetch',
			headers: {
				'Content-Type': 'text/plain'
			}
		});

		expect(response1.headers.get('content-type')).to.equal('text/plain');
		expect(response1.status).to.equal(301);
		expect(response1.statusText).to.equal('node-fetch');

		const response2 = Response.json(null, {
			headers: {
				'CoNtEnT-TypE': 'text/plain'
			}
		});

		expect(response2.headers.get('content-type')).to.equal('text/plain');
	});
});

describe('node-fetch using IPv6', () => {
	const local = new TestServer('[::1]');
	let base;

	before(async () => {
		await local.start();
		base = `http://${local.hostname}:${local.port}/`;
	});

	after(async () => {
		return local.stop();
	});

	it('should resolve into response', async () => {
		const url = `${base}hello`;
		expect(url).to.contain('[::1]');
		const res = await fetch(url);
		expect(res).to.be.an.instanceof(Response);
		expect(res.headers).to.be.an.instanceof(Headers);
		expect(res.body).to.be.an.instanceof(stream.Transform);
		expect(res.bodyUsed).to.be.false;

		expect(res.url).to.equal(url);
		expect(res.ok).to.be.true;
		expect(res.status).to.equal(200);
		expect(res.statusText).to.equal('OK');
	});
});
