// Test tools
import zlib from 'zlib';
import crypto from 'crypto';
import {spawn} from 'child_process';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as stream from 'stream';
import {lookup} from 'dns';
import vm from 'vm';
import chai from 'chai';
import chaiPromised from 'chai-as-promised';
import chaiIterator from 'chai-iterator';
import chaiString from 'chai-string';
import then from 'promise';
import resumer from 'resumer';
import FormData from 'form-data';
import stringToArrayBuffer from 'string-to-arraybuffer';

import {AbortController} from 'abortcontroller-polyfill/dist/abortcontroller';
import AbortController2 from 'abort-controller';

// Test subjects
import Blob from 'fetch-blob';
import fetch, {
	FetchError,
	Headers,
	Request,
	Response
} from '../src';
import FetchErrorOrig from '../src/errors/fetch-error';
import HeadersOrig, {createHeadersLenient} from '../src/headers';
import RequestOrig from '../src/request';
import ResponseOrig from '../src/response';
import Body, {getTotalBytes, extractContentType} from '../src/body';
import TestServer from './server';

const {
	Uint8Array: VMUint8Array
} = vm.runInNewContext('this');

import chaiTimeout from './chai-timeout';

chai.use(chaiPromised);
chai.use(chaiIterator);
chai.use(chaiString);
chai.use(chaiTimeout);
const {expect} = chai;

const local = new TestServer();
const base = `http://${local.hostname}:${local.port}/`;

before(done => {
	local.start(done);
});

after(done => {
	local.stop(done);
});

const itIf = val => val ? it : it.skip;

describe('node-fetch', () => {
	it('should return a promise', () => {
		const url = `${base}hello`;
		const p = fetch(url);
		expect(p).to.be.an.instanceof(fetch.Promise);
		expect(p).to.have.property('then');
	});

	it('should allow custom promise', () => {
		const url = `${base}hello`;
		const old = fetch.Promise;
		fetch.Promise = then;
		expect(fetch(url)).to.be.an.instanceof(then);
		expect(fetch(url)).to.not.be.an.instanceof(old);
		fetch.Promise = old;
	});

	it('should throw error when no promise implementation are found', () => {
		const url = `${base}hello`;
		const old = fetch.Promise;
		fetch.Promise = undefined;
		expect(() => {
			fetch(url);
		}).to.throw(Error);
		fetch.Promise = old;
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
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, 'Only absolute URLs are supported');
	});

	it('should reject with error if url is relative path', () => {
		const url = '/some/path';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, 'Only absolute URLs are supported');
	});

	it('should reject with error if protocol is unsupported', () => {
		const url = 'ftp://example.com/';
		return expect(fetch(url)).to.eventually.be.rejectedWith(TypeError, 'Only HTTP(S) protocols are supported');
	});

	itIf(process.platform !== 'win32')('should reject with error on network failure', () => {
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

	itIf(process.platform !== 'win32')('system error is extracted from failed requests', () => {
		const url = 'http://localhost:50000/';
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('erroredSysCall');
	});

	it('should resolve into response', () => {
		const url = `${base}hello`;
		return fetch(url).then(res => {
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

	it('should accept plain text response', () => {
		const url = `${base}plain`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('text');
			});
		});
	});

	it('should accept html response (like plain text)', () => {
		const url = `${base}html`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/html');
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('<html></html>');
			});
		});
	});

	it('should accept json response', () => {
		const url = `${base}json`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('application/json');
			return res.json().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.an('object');
				expect(result).to.deep.equal({name: 'value'});
			});
		});
	});

	it('should send request with custom headers', () => {
		const url = `${base}inspect`;
		const opts = {
			headers: {'x-custom-header': 'abc'}
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers['x-custom-header']).to.equal('abc');
		});
	});

	it('should accept headers instance', () => {
		const url = `${base}inspect`;
		const opts = {
			headers: new Headers({'x-custom-header': 'abc'})
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers['x-custom-header']).to.equal('abc');
		});
	});

	it('should accept custom host header', () => {
		const url = `${base}inspect`;
		const opts = {
			headers: {
				host: 'example.com'
			}
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers.host).to.equal('example.com');
		});
	});

	it('should accept custom HoSt header', () => {
		const url = `${base}inspect`;
		const opts = {
			headers: {
				HoSt: 'example.com'
			}
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers.host).to.equal('example.com');
		});
	});

	it('should follow redirect code 301', () => {
		const url = `${base}redirect/301`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			expect(res.ok).to.be.true;
		});
	});

	it('should follow redirect code 302', () => {
		const url = `${base}redirect/302`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 303', () => {
		const url = `${base}redirect/303`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 307', () => {
		const url = `${base}redirect/307`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect code 308', () => {
		const url = `${base}redirect/308`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow redirect chain', () => {
		const url = `${base}redirect/chain`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should follow POST request redirect code 301 with GET', () => {
		const url = `${base}redirect/301`;
		const opts = {
			method: 'POST',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(result => {
				expect(result.method).to.equal('GET');
				expect(result.body).to.equal('');
			});
		});
	});

	it('should follow PATCH request redirect code 301 with PATCH', () => {
		const url = `${base}redirect/301`;
		const opts = {
			method: 'PATCH',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(res => {
				expect(res.method).to.equal('PATCH');
				expect(res.body).to.equal('a=1');
			});
		});
	});

	it('should follow POST request redirect code 302 with GET', () => {
		const url = `${base}redirect/302`;
		const opts = {
			method: 'POST',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(result => {
				expect(result.method).to.equal('GET');
				expect(result.body).to.equal('');
			});
		});
	});

	it('should follow PATCH request redirect code 302 with PATCH', () => {
		const url = `${base}redirect/302`;
		const opts = {
			method: 'PATCH',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(res => {
				expect(res.method).to.equal('PATCH');
				expect(res.body).to.equal('a=1');
			});
		});
	});

	it('should follow redirect code 303 with GET', () => {
		const url = `${base}redirect/303`;
		const opts = {
			method: 'PUT',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(result => {
				expect(result.method).to.equal('GET');
				expect(result.body).to.equal('');
			});
		});
	});

	it('should follow PATCH request redirect code 307 with PATCH', () => {
		const url = `${base}redirect/307`;
		const opts = {
			method: 'PATCH',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
			return res.json().then(result => {
				expect(result.method).to.equal('PATCH');
				expect(result.body).to.equal('a=1');
			});
		});
	});

	it('should not follow non-GET redirect if body is a readable stream', () => {
		const url = `${base}redirect/307`;
		const opts = {
			method: 'PATCH',
			body: resumer().queue('a=1').end()
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'unsupported-redirect');
	});

	it('should obey maximum redirect, reject case', () => {
		const url = `${base}redirect/chain`;
		const opts = {
			follow: 1
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-redirect');
	});

	it('should obey redirect chain, resolve case', () => {
		const url = `${base}redirect/chain`;
		const opts = {
			follow: 2
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			expect(res.status).to.equal(200);
		});
	});

	it('should allow not following redirect', () => {
		const url = `${base}redirect/301`;
		const opts = {
			follow: 0
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'max-redirect');
	});

	it('should support redirect mode, manual flag', () => {
		const url = `${base}redirect/301`;
		const opts = {
			redirect: 'manual'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(url);
			expect(res.status).to.equal(301);
			expect(res.headers.get('location')).to.equal(`${base}inspect`);
		});
	});

	it('should support redirect mode, error flag', () => {
		const url = `${base}redirect/301`;
		const opts = {
			redirect: 'error'
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'no-redirect');
	});

	it('should support redirect mode, manual flag when there is no redirect', () => {
		const url = `${base}hello`;
		const opts = {
			redirect: 'manual'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(url);
			expect(res.status).to.equal(200);
			expect(res.headers.get('location')).to.be.null;
		});
	});

	it('should follow redirect code 301 and keep existing headers', () => {
		const url = `${base}redirect/301`;
		const opts = {
			headers: new Headers({'x-custom-header': 'abc'})
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(`${base}inspect`);
			return res.json();
		}).then(res => {
			expect(res.headers['x-custom-header']).to.equal('abc');
		});
	});

	it('should treat broken redirect as ordinary response (follow)', () => {
		const url = `${base}redirect/no-location`;
		return fetch(url).then(res => {
			expect(res.url).to.equal(url);
			expect(res.status).to.equal(301);
			expect(res.headers.get('location')).to.be.null;
		});
	});

	it('should treat broken redirect as ordinary response (manual)', () => {
		const url = `${base}redirect/no-location`;
		const opts = {
			redirect: 'manual'
		};
		return fetch(url, opts).then(res => {
			expect(res.url).to.equal(url);
			expect(res.status).to.equal(301);
			expect(res.headers.get('location')).to.be.null;
		});
	});

	it('should set redirected property on response when redirect', () => {
		const url = `${base}redirect/301`;
		return fetch(url).then(res => {
			expect(res.redirected).to.be.true;
		});
	});

	it('should not set redirected property on response without redirect', () => {
		const url = `${base}hello`;
		return fetch(url).then(res => {
			expect(res.redirected).to.be.false;
		});
	});

	it('should ignore invalid headers', () => {
		let headers = {
			'Invalid-Header ': 'abc\r\n',
			'Invalid-Header-Value': '\u0007k\r\n',
			'Set-Cookie': ['\u0007k\r\n', '\u0007kk\r\n']
		};
		headers = createHeadersLenient(headers);
		expect(headers).to.not.have.property('Invalid-Header ');
		expect(headers).to.not.have.property('Invalid-Header-Value');
		expect(headers).to.not.have.property('Set-Cookie');
	});

	it('should handle client-error response', () => {
		const url = `${base}error/400`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.status).to.equal(400);
			expect(res.statusText).to.equal('Bad Request');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('client error');
			});
		});
	});

	it('should handle server-error response', () => {
		const url = `${base}error/500`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.status).to.equal(500);
			expect(res.statusText).to.equal('Internal Server Error');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(res.bodyUsed).to.be.true;
				expect(result).to.be.a('string');
				expect(result).to.equal('server error');
			});
		});
	});

	it('should handle network-error response', () => {
		const url = `${base}error/reset`;
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code', 'ECONNRESET');
	});

	it('should handle DNS-error response', () => {
		const url = 'http://domain.invalid';
		return expect(fetch(url)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('code', 'ENOTFOUND');
	});

	it('should reject invalid json response', () => {
		const url = `${base}error/json`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('application/json');
			return expect(res.json()).to.eventually.be.rejectedWith(Error);
		});
	});

	it('should handle no content response', () => {
		const url = `${base}no-content`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.ok).to.be.true;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should reject when trying to parse no content response as json', () => {
		const url = `${base}no-content`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.ok).to.be.true;
			return expect(res.json()).to.eventually.be.rejectedWith(Error);
		});
	});

	it('should handle no content response with gzip encoding', () => {
		const url = `${base}no-content/gzip`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.headers.get('content-encoding')).to.equal('gzip');
			expect(res.ok).to.be.true;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should handle not modified response', () => {
		const url = `${base}not-modified`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(304);
			expect(res.statusText).to.equal('Not Modified');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should handle not modified response with gzip encoding', () => {
		const url = `${base}not-modified/gzip`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(304);
			expect(res.statusText).to.equal('Not Modified');
			expect(res.headers.get('content-encoding')).to.equal('gzip');
			expect(res.ok).to.be.false;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should decompress gzip response', () => {
		const url = `${base}gzip`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress slightly invalid gzip response', () => {
		const url = `${base}gzip-truncated`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should make capitalised Content-Encoding lowercase', () => {
		const url = `${base}gzip-capital`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-encoding')).to.equal('gzip');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress deflate response', () => {
		const url = `${base}deflate`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress deflate raw response from old apache server', () => {
		const url = `${base}deflate-raw`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should decompress brotli response', function () {
		if (typeof zlib.createBrotliDecompress !== 'function') {
			this.skip();
		}

		const url = `${base}brotli`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('hello world');
			});
		});
	});

	it('should handle no content response with brotli encoding', function () {
		if (typeof zlib.createBrotliDecompress !== 'function') {
			this.skip();
		}

		const url = `${base}no-content/brotli`;
		return fetch(url).then(res => {
			expect(res.status).to.equal(204);
			expect(res.statusText).to.equal('No Content');
			expect(res.headers.get('content-encoding')).to.equal('br');
			expect(res.ok).to.be.true;
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.be.empty;
			});
		});
	});

	it('should skip decompression if unsupported', () => {
		const url = `${base}sdch`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.equal('fake sdch string');
			});
		});
	});

	it('should reject if response compression is invalid', () => {
		const url = `${base}invalid-content-encoding`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('code', 'Z_DATA_ERROR');
		});
	});

	it('should handle errors on the body stream even if it is not used', done => {
		const url = `${base}invalid-content-encoding`;
		fetch(url)
			.then(res => {
				expect(res.status).to.equal(200);
			})
			.catch(() => { })
			.then(() => {
				// Wait a few ms to see if a uncaught error occurs
				setTimeout(() => {
					done();
				}, 20);
			});
	});

	it('should collect handled errors on the body stream to reject if the body is used later', () => {
		function delay(value) {
			return new Promise(resolve => {
				setTimeout(() => {
					resolve(value);
				}, 20);
			});
		}

		const url = `${base}invalid-content-encoding`;
		return fetch(url).then(delay).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('code', 'Z_DATA_ERROR');
		});
	});

	it('should allow disabling auto decompression', () => {
		const url = `${base}gzip`;
		const opts = {
			compress: false
		};
		return fetch(url, opts).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(result => {
				expect(result).to.be.a('string');
				expect(result).to.not.equal('hello world');
			});
		});
	});

	it('should not overwrite existing accept-encoding header when auto decompression is true', () => {
		const url = `${base}inspect`;
		const opts = {
			compress: true,
			headers: {
				'Accept-Encoding': 'gzip'
			}
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.headers['accept-encoding']).to.equal('gzip');
		});
	});

	it('should allow custom timeout', () => {
		const url = `${base}timeout`;
		const opts = {
			timeout: 20
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'request-timeout');
	});

	it('should allow custom timeout on response body', () => {
		const url = `${base}slow`;
		const opts = {
			timeout: 20
		};
		return fetch(url, opts).then(res => {
			expect(res.ok).to.be.true;
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('type', 'body-timeout');
		});
	});

	it('should allow custom timeout on redirected requests', () => {
		const url = `${base}redirect/slow-chain`;
		const opts = {
			timeout: 20
		};
		return expect(fetch(url, opts)).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.have.property('type', 'request-timeout');
	});

	it('should clear internal timeout on fetch response', function (done) {
		this.timeout(2000);
		spawn('node', ['-e', `require('./')('${base}hello', { timeout: 10000 })`])
			.on('exit', () => {
				done();
			});
	});

	it('should clear internal timeout on fetch redirect', function (done) {
		this.timeout(2000);
		spawn('node', ['-e', `require('./')('${base}redirect/301', { timeout: 10000 })`])
			.on('exit', () => {
				done();
			});
	});

	it('should clear internal timeout on fetch error', function (done) {
		this.timeout(2000);
		spawn('node', ['-e', `require('./')('${base}error/reset', { timeout: 10000 })`])
			.on('exit', () => {
				done();
			});
	});

	it('should support request cancellation with signal', function () {
		this.timeout(500);
		const controller = new AbortController();
		const controller2 = new AbortController2();

		const fetches = [
			fetch(`${base}timeout`, {signal: controller.signal}),
			fetch(`${base}timeout`, {signal: controller2.signal}),
			fetch(
				`${base}timeout`,
				{
					method: 'POST',
					signal: controller.signal,
					headers: {
						'Content-Type': 'application/json',
						body: JSON.stringify({hello: 'world'})
					}
				}
			)
		];
		setTimeout(() => {
			controller.abort();
			controller2.abort();
		}, 100);

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
		const controller = new AbortController();
		const opts = {
			signal: controller.signal
		};
		controller.abort();
		const fetched = fetch(url, opts);
		return expect(fetched).to.eventually.be.rejected
			.and.be.an.instanceOf(Error)
			.and.include({
				type: 'aborted',
				name: 'AbortError'
			});
	});

	it('should clear internal timeout when request is cancelled with an AbortSignal', function (done) {
		this.timeout(2000);
		const script = `
			var AbortController = require('abortcontroller-polyfill/dist/cjs-ponyfill').AbortController;
			var controller = new AbortController();
			require('./')(
				'${base}timeout',
				{ signal: controller.signal, timeout: 10000 }
			);
			setTimeout(function () { controller.abort(); }, 20);
		`;
		spawn('node', ['-e', script])
			.on('exit', () => {
				done();
			});
	});

	it('should remove internal AbortSignal event listener after request is aborted', () => {
		const controller = new AbortController();
		const {signal} = controller;
		const promise = fetch(
			`${base}timeout`,
			{signal}
		);
		const result = expect(promise).to.eventually.be.rejected
			.and.be.an.instanceof(Error)
			.and.have.property('name', 'AbortError')
			.then(() => {
				expect(signal.listeners.abort.length).to.equal(0);
			});
		controller.abort();
		return result;
	});

	it('should allow redirects to be aborted', () => {
		const abortController = new AbortController();
		const request = new Request(`${base}redirect/slow`, {
			signal: abortController.signal
		});
		setTimeout(() => {
			abortController.abort();
		}, 20);
		return expect(fetch(request)).to.be.eventually.rejected
			.and.be.an.instanceOf(Error)
			.and.have.property('name', 'AbortError');
	});

	it('should allow redirected response body to be aborted', () => {
		const abortController = new AbortController();
		const request = new Request(`${base}redirect/slow-stream`, {
			signal: abortController.signal
		});
		return expect(fetch(request).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			const result = res.text();
			abortController.abort();
			return result;
		})).to.be.eventually.rejected
			.and.be.an.instanceOf(Error)
			.and.have.property('name', 'AbortError');
	});

	it('should remove internal AbortSignal event listener after request and response complete without aborting', () => {
		const controller = new AbortController();
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

	it('should reject response body with AbortError when aborted before stream has been read completely', () => {
		const controller = new AbortController();
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
		const controller = new AbortController();
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
		const controller = new AbortController();
		expect(fetch(
			`${base}slow`,
			{signal: controller.signal}
		))
			.to.eventually.be.fulfilled
			.then(res => {
				res.body.on('error', err => {
					expect(err)
						.to.be.an.instanceof(Error)
						.and.have.property('name', 'AbortError');
					done();
				});
				controller.abort();
			});
	});

	it('should cancel request body of type Stream with AbortError when aborted', () => {
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
						expect(error).to.be.an.instanceof(Error).and.have.property('name', 'AbortError');
						resolve();
					} catch (error2) {
						reject(error2);
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

	it('should throw a TypeError if a signal is not of type AbortSignal', () => {
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

	it('should set default User-Agent', () => {
		const url = `${base}inspect`;
		return fetch(url).then(res => res.json()).then(res => {
			expect(res.headers['user-agent']).to.startWith('node-fetch/');
		});
	});

	it('should allow setting User-Agent', () => {
		const url = `${base}inspect`;
		const opts = {
			headers: {
				'user-agent': 'faked'
			}
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.headers['user-agent']).to.equal('faked');
		});
	});

	it('should set default Accept header', () => {
		const url = `${base}inspect`;
		fetch(url).then(res => res.json()).then(res => {
			expect(res.headers.accept).to.equal('*/*');
		});
	});

	it('should allow setting Accept header', () => {
		const url = `${base}inspect`;
		const opts = {
			headers: {
				accept: 'application/json'
			}
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.headers.accept).to.equal('application/json');
		});
	});

	it('should allow POST request', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('0');
		});
	});

	it('should allow POST request with string body', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.equal('text/plain;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with buffer body', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: Buffer.from('a=1', 'utf-8')
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with ArrayBuffer body', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: stringToArrayBuffer('Hello, world!\n')
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('Hello, world!\n');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('14');
		});
	});

	it('should allow POST request with ArrayBuffer body from a VM context', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: new VMUint8Array(Buffer.from('Hello, world!\n')).buffer
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('Hello, world!\n');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('14');
		});
	});

	it('should allow POST request with ArrayBufferView (Uint8Array) body', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: new Uint8Array(stringToArrayBuffer('Hello, world!\n'))
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('Hello, world!\n');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('14');
		});
	});

	it('should allow POST request with ArrayBufferView (DataView) body', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: new DataView(stringToArrayBuffer('Hello, world!\n'))
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('Hello, world!\n');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('14');
		});
	});

	it('should allow POST request with ArrayBufferView (Uint8Array) body from a VM context', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: new VMUint8Array(Buffer.from('Hello, world!\n'))
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('Hello, world!\n');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('14');
		});
	});

	it('should allow POST request with ArrayBufferView (Uint8Array, offset, length) body', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: new Uint8Array(stringToArrayBuffer('Hello, world!\n'), 7, 6)
		};
		return fetch(url, opts).then(res => res.json()).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('world!');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('6');
		});
	});

	it('should allow POST request with blob body without type', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: new Blob(['a=1'])
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with blob body with type', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: new Blob(['a=1'], {
				type: 'text/plain;charset=UTF-8'
			})
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.equal('text/plain;charset=utf-8');
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow POST request with readable stream as body', () => {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());

		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.equal('chunked');
			expect(res.headers['content-type']).to.be.undefined;
			expect(res.headers['content-length']).to.be.undefined;
		});
	});

	it('should allow POST request with form-data as body', () => {
		const form = new FormData();
		form.append('a', '1');

		const url = `${base}multipart`;
		const opts = {
			method: 'POST',
			body: form
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.startWith('multipart/form-data;boundary=');
			expect(res.headers['content-length']).to.be.a('string');
			expect(res.body).to.equal('a=1');
		});
	});

	itIf(process.platform !== 'win32')('should allow POST request with form-data using stream as body', () => {
		const form = new FormData();
		form.append('my_field', fs.createReadStream(path.join(__dirname, 'dummy.txt')));

		const url = `${base}multipart`;
		const opts = {
			method: 'POST',
			body: form
		};

		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.startWith('multipart/form-data;boundary=');
			expect(res.headers['content-length']).to.be.undefined;
			expect(res.body).to.contain('my_field=');
		});
	});

	it('should allow POST request with form-data as body and custom headers', () => {
		const form = new FormData();
		form.append('a', '1');

		const headers = form.getHeaders();
		headers.b = '2';

		const url = `${base}multipart`;
		const opts = {
			method: 'POST',
			body: form,
			headers
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.startWith('multipart/form-data; boundary=');
			expect(res.headers['content-length']).to.be.a('string');
			expect(res.headers.b).to.equal('2');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow POST request with object body', () => {
		const url = `${base}inspect`;
		// Note that fetch simply calls tostring on an object
		const opts = {
			method: 'POST',
			body: {a: 1}
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('[object Object]');
			expect(res.headers['content-type']).to.equal('text/plain;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('15');
		});
	});

	it('constructing a Response with URLSearchParams as body should have a Content-Type', () => {
		const params = new URLSearchParams();
		const res = new Response(params);
		res.headers.get('Content-Type');
		expect(res.headers.get('Content-Type')).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
	});

	it('constructing a Request with URLSearchParams as body should have a Content-Type', () => {
		const params = new URLSearchParams();
		const req = new Request(base, {method: 'POST', body: params});
		expect(req.headers.get('Content-Type')).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
	});

	it('Reading a body with URLSearchParams should echo back the result', () => {
		const params = new URLSearchParams();
		params.append('a', '1');
		return new Response(params).text().then(text => {
			expect(text).to.equal('a=1');
		});
	});

	// Body should been cloned...
	it('constructing a Request/Response with URLSearchParams and mutating it should not affected body', () => {
		const params = new URLSearchParams();
		const req = new Request(`${base}inspect`, {method: 'POST', body: params});
		params.append('a', '1');
		return req.text().then(text => {
			expect(text).to.equal('');
		});
	});

	it('should allow POST request with URLSearchParams as body', () => {
		const params = new URLSearchParams();
		params.append('a', '1');

		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: params
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should still recognize URLSearchParams when extended', () => {
		class CustomSearchParams extends URLSearchParams { }
		const params = new CustomSearchParams();
		params.append('a', '1');

		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: params
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
			expect(res.body).to.equal('a=1');
		});
	});

	/* For 100% code coverage, checks for duck-typing-only detection
	 * where both constructor.name and brand tests fail */
	it('should still recognize URLSearchParams when extended from polyfill', () => {
		class CustomPolyfilledSearchParams extends URLSearchParams { }
		const params = new CustomPolyfilledSearchParams();
		params.append('a', '1');

		const url = `${base}inspect`;
		const opts = {
			method: 'POST',
			body: params
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.headers['content-type']).to.equal('application/x-www-form-urlencoded;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should overwrite Content-Length if possible', () => {
		const url = `${base}inspect`;
		// Note that fetch simply calls tostring on an object
		const opts = {
			method: 'POST',
			headers: {
				'Content-Length': '1000'
			},
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('POST');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-type']).to.equal('text/plain;charset=UTF-8');
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow PUT request', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'PUT',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('PUT');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow DELETE request', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'DELETE'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('DELETE');
		});
	});

	it('should allow DELETE request with string body', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'DELETE',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('DELETE');
			expect(res.body).to.equal('a=1');
			expect(res.headers['transfer-encoding']).to.be.undefined;
			expect(res.headers['content-length']).to.equal('3');
		});
	});

	it('should allow PATCH request', () => {
		const url = `${base}inspect`;
		const opts = {
			method: 'PATCH',
			body: 'a=1'
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.method).to.equal('PATCH');
			expect(res.body).to.equal('a=1');
		});
	});

	it('should allow HEAD request', () => {
		const url = `${base}hello`;
		const opts = {
			method: 'HEAD'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.statusText).to.equal('OK');
			expect(res.headers.get('content-type')).to.equal('text/plain');
			expect(res.body).to.be.an.instanceof(stream.Transform);
			return res.text();
		}).then(text => {
			expect(text).to.equal('');
		});
	});

	it('should allow HEAD request with content-encoding header', () => {
		const url = `${base}error/404`;
		const opts = {
			method: 'HEAD'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(404);
			expect(res.headers.get('content-encoding')).to.equal('gzip');
			return res.text();
		}).then(text => {
			expect(text).to.equal('');
		});
	});

	it('should allow OPTIONS request', () => {
		const url = `${base}options`;
		const opts = {
			method: 'OPTIONS'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.statusText).to.equal('OK');
			expect(res.headers.get('allow')).to.equal('GET, HEAD, OPTIONS');
			expect(res.body).to.be.an.instanceof(stream.Transform);
		});
	});

	it('should reject decoding body twice', () => {
		const url = `${base}plain`;
		return fetch(url).then(res => {
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return res.text().then(() => {
				expect(res.bodyUsed).to.be.true;
				return expect(res.text()).to.eventually.be.rejectedWith(Error);
			});
		});
	});

	it('should support maximum response size, multiple chunk', () => {
		const url = `${base}size/chunk`;
		const opts = {
			size: 5
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('type', 'max-size');
		});
	});

	it('should support maximum response size, single chunk', () => {
		const url = `${base}size/long`;
		const opts = {
			size: 5
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.headers.get('content-type')).to.equal('text/plain');
			return expect(res.text()).to.eventually.be.rejected
				.and.be.an.instanceOf(FetchError)
				.and.have.property('type', 'max-size');
		});
	});

	it('should allow piping response body as stream', () => {
		const url = `${base}hello`;
		return fetch(url).then(res => {
			expect(res.body).to.be.an.instanceof(stream.Transform);
			return streamToPromise(res.body, chunk => {
				if (chunk === null) {
					return;
				}

				expect(chunk.toString()).to.equal('world');
			});
		});
	});

	it('should allow cloning a response, and use both as stream', () => {
		const url = `${base}hello`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			expect(res.body).to.be.an.instanceof(stream.Transform);
			expect(r1.body).to.be.an.instanceof(stream.Transform);
			const dataHandler = chunk => {
				if (chunk === null) {
					return;
				}

				expect(chunk.toString()).to.equal('world');
			};

			return Promise.all([
				streamToPromise(res.body, dataHandler),
				streamToPromise(r1.body, dataHandler)
			]);
		});
	});

	it('should allow cloning a json response and log it as text response', () => {
		const url = `${base}json`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			return Promise.all([res.json(), r1.text()]).then(results => {
				expect(results[0]).to.deep.equal({name: 'value'});
				expect(results[1]).to.equal('{"name":"value"}');
			});
		});
	});

	it('should allow cloning a json response, and then log it as text response', () => {
		const url = `${base}json`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			return res.json().then(result => {
				expect(result).to.deep.equal({name: 'value'});
				return r1.text().then(result => {
					expect(result).to.equal('{"name":"value"}');
				});
			});
		});
	});

	it('should allow cloning a json response, first log as text response, then return json object', () => {
		const url = `${base}json`;
		return fetch(url).then(res => {
			const r1 = res.clone();
			return r1.text().then(result => {
				expect(result).to.equal('{"name":"value"}');
				return res.json().then(result => {
					expect(result).to.deep.equal({name: 'value'});
				});
			});
		});
	});

	it('should not allow cloning a response after its been used', () => {
		const url = `${base}hello`;
		return fetch(url).then(res =>
			res.text().then(() => {
				expect(() => {
					res.clone();
				}).to.throw(Error);
			})
		);
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
		this.timeout(300);
		const url = local.mockResponse(res => {
			res.end(crypto.randomBytes(2 * 512 * 1024 - 1));
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

	it('should return all headers using raw()', () => {
		const url = `${base}cookie`;
		return fetch(url).then(res => {
			const expected = [
				'a=1',
				'b=1'
			];

			expect(res.headers.raw()['set-cookie']).to.deep.equal(expected);
		});
	});

	it('should allow deleting header', () => {
		const url = `${base}cookie`;
		return fetch(url).then(res => {
			res.headers.delete('set-cookie');
			expect(res.headers.get('set-cookie')).to.be.null;
		});
	});

	it('should send request with connection keep-alive if agent is provided', () => {
		const url = `${base}inspect`;
		const opts = {
			agent: new http.Agent({
				keepAlive: true
			})
		};
		return fetch(url, opts).then(res => {
			return res.json();
		}).then(res => {
			expect(res.headers.connection).to.equal('keep-alive');
		});
	});

	it('should support fetch with Request instance', () => {
		const url = `${base}hello`;
		const req = new Request(url);
		return fetch(req).then(res => {
			expect(res.url).to.equal(url);
			expect(res.ok).to.be.true;
			expect(res.status).to.equal(200);
		});
	});

	it('should support fetch with Node.js URL object', () => {
		const url = `${base}hello`;
		const urlObj = new URL(url);
		const req = new Request(urlObj);
		return fetch(req).then(res => {
			expect(res.url).to.equal(url);
			expect(res.ok).to.be.true;
			expect(res.status).to.equal(200);
		});
	});

	it('should support fetch with WHATWG URL object', () => {
		const url = `${base}hello`;
		const urlObj = new URL(url);
		const req = new Request(urlObj);
		return fetch(req).then(res => {
			expect(res.url).to.equal(url);
			expect(res.ok).to.be.true;
			expect(res.status).to.equal(200);
		});
	});

	it('should support reading blob as text', () => {
		return new Response('hello')
			.blob()
			.then(blob => blob.text())
			.then(body => {
				expect(body).to.equal('hello');
			});
	});

	it('should support reading blob as arrayBuffer', () => {
		return new Response('hello')
			.blob()
			.then(blob => blob.arrayBuffer())
			.then(ab => {
				const str = String.fromCharCode.apply(null, new Uint8Array(ab));
				expect(str).to.equal('hello');
			});
	});

	it('should support reading blob as stream', () => {
		return new Response('hello')
			.blob()
			.then(blob => streamToPromise(blob.stream(), data => {
				const str = data.toString();
				expect(str).to.equal('hello');
			}));
	});

	it('should support blob round-trip', () => {
		const url = `${base}hello`;

		let length;
		let type;

		return fetch(url).then(res => res.blob()).then(blob => {
			const url = `${base}inspect`;
			length = blob.size;
			type = blob.type;
			return fetch(url, {
				method: 'POST',
				body: blob
			});
		}).then(res => res.json()).then(({body, headers}) => {
			expect(body).to.equal('world');
			expect(headers['content-type']).to.equal(type);
			expect(headers['content-length']).to.equal(String(length));
		});
	});

	it('should support overwrite Request instance', () => {
		const url = `${base}inspect`;
		const req = new Request(url, {
			method: 'POST',
			headers: {
				a: '1'
			}
		});
		return fetch(req, {
			method: 'GET',
			headers: {
				a: '2'
			}
		}).then(res => {
			return res.json();
		}).then(body => {
			expect(body.method).to.equal('GET');
			expect(body.headers.a).to.equal('2');
		});
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

	it('should support https request', function () {
		this.timeout(5000);
		const url = 'https://github.com/';
		const opts = {
			method: 'HEAD'
		};
		return fetch(url, opts).then(res => {
			expect(res.status).to.equal(200);
			expect(res.ok).to.be.true;
		});
	});

	// Issue #414
	it('should reject if attempt to accumulate body stream throws', () => {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const res = new Response(body);
		const bufferConcat = Buffer.concat;
		const restoreBufferConcat = () => {
			Buffer.concat = bufferConcat;
		};

		Buffer.concat = () => {
			throw new Error('embedded error');
		};

		const textPromise = res.text();
		// Ensure that `Buffer.concat` is always restored:
		textPromise.then(restoreBufferConcat, restoreBufferConcat);

		return expect(textPromise).to.eventually.be.rejected
			.and.be.an.instanceOf(FetchError)
			.and.include({type: 'system'})
			.and.have.property('message').that.includes('Could not create Buffer')
			.and.that.includes('embedded error');
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

	it('supports supplying a famliy option to the agent', () => {
		const url = `${base}redirect/301`;
		const families = [];
		const family = Symbol('family');
		function lookupSpy(hostname, options, callback) {
			families.push(options.family);
			return lookup(hostname, {}, callback);
		}

		const agent = http.Agent({lookup: lookupSpy, family});
		return fetch(url, {agent}).then(() => {
			expect(families).to.have.length(2);
			expect(families[0]).to.equal(family);
			expect(families[1]).to.equal(family);
		});
	});

	it('should allow a function supplying the agent', () => {
		const url = `${base}inspect`;

		const agent = new http.Agent({
			keepAlive: true
		});

		let parsedURL;

		return fetch(url, {
			agent(_parsedURL) {
				parsedURL = _parsedURL;
				return agent;
			}
		}).then(res => {
			return res.json();
		}).then(res => {
			// The agent provider should have been called
			expect(parsedURL.protocol).to.equal('http:');
			// The agent we returned should have been used
			expect(res.headers.connection).to.equal('keep-alive');
		});
	});

	it('should calculate content length and extract content type for each body type', () => {
		const url = `${base}hello`;
		const bodyContent = 'a=1';

		let streamBody = resumer().queue(bodyContent).end();
		streamBody = streamBody.pipe(new stream.PassThrough());
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

		const bufferBody = Buffer.from(bodyContent);
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
});

describe('Headers', () => {
	it('should have attributes conforming to Web IDL', () => {
		const headers = new Headers();
		expect(Object.getOwnPropertyNames(headers)).to.be.empty;
		const enumerableProperties = [];

		for (const property in headers) {
			enumerableProperties.push(property);
		}

		for (const toCheck of [
			'append',
			'delete',
			'entries',
			'forEach',
			'get',
			'has',
			'keys',
			'set',
			'values'
		]) {
			expect(enumerableProperties).to.contain(toCheck);
		}
	});

	it('should allow iterating through all headers with forEach', () => {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['b', '3'],
			['a', '1']
		]);
		expect(headers).to.have.property('forEach');

		const result = [];
		headers.forEach((val, key) => {
			result.push([key, val]);
		});

		expect(result).to.deep.equal([
			['a', '1'],
			['b', '2, 3'],
			['c', '4']
		]);
	});

	it('should allow iterating through all headers with for-of loop', () => {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');
		expect(headers).to.be.iterable;

		const result = [];
		for (const pair of headers) {
			result.push(pair);
		}

		expect(result).to.deep.equal([
			['a', '1'],
			['b', '2, 3'],
			['c', '4']
		]);
	});

	it('should allow iterating through all headers with entries()', () => {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');

		expect(headers.entries()).to.be.iterable
			.and.to.deep.iterate.over([
				['a', '1'],
				['b', '2, 3'],
				['c', '4']
			]);
	});

	it('should allow iterating through all headers with keys()', () => {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');

		expect(headers.keys()).to.be.iterable
			.and.to.iterate.over(['a', 'b', 'c']);
	});

	it('should allow iterating through all headers with values()', () => {
		const headers = new Headers([
			['b', '2'],
			['c', '4'],
			['a', '1']
		]);
		headers.append('b', '3');

		expect(headers.values()).to.be.iterable
			.and.to.iterate.over(['1', '2, 3', '4']);
	});

	it('should reject illegal header', () => {
		const headers = new Headers();
		expect(() => new Headers({'He y': 'ok'})).to.throw(TypeError);
		expect(() => new Headers({'Hé-y': 'ok'})).to.throw(TypeError);
		expect(() => new Headers({'He-y': 'ăk'})).to.throw(TypeError);
		expect(() => headers.append('Hé-y', 'ok')).to.throw(TypeError);
		expect(() => headers.delete('Hé-y')).to.throw(TypeError);
		expect(() => headers.get('Hé-y')).to.throw(TypeError);
		expect(() => headers.has('Hé-y')).to.throw(TypeError);
		expect(() => headers.set('Hé-y', 'ok')).to.throw(TypeError);
		// Should reject empty header
		expect(() => headers.append('', 'ok')).to.throw(TypeError);

		// 'o k' is valid value but invalid name
		new Headers({'He-y': 'o k'});
	});

	it('should ignore unsupported attributes while reading headers', () => {
		const FakeHeader = function () { };
		// Prototypes are currently ignored
		// This might change in the future: #181
		FakeHeader.prototype.z = 'fake';

		const res = new FakeHeader();
		res.a = 'string';
		res.b = ['1', '2'];
		res.c = '';
		res.d = [];
		res.e = 1;
		res.f = [1, 2];
		res.g = {a: 1};
		res.h = undefined;
		res.i = null;
		res.j = NaN;
		res.k = true;
		res.l = false;
		res.m = Buffer.from('test');

		const h1 = new Headers(res);
		h1.set('n', [1, 2]);
		h1.append('n', ['3', 4]);

		const h1Raw = h1.raw();

		expect(h1Raw.a).to.include('string');
		expect(h1Raw.b).to.include('1,2');
		expect(h1Raw.c).to.include('');
		expect(h1Raw.d).to.include('');
		expect(h1Raw.e).to.include('1');
		expect(h1Raw.f).to.include('1,2');
		expect(h1Raw.g).to.include('[object Object]');
		expect(h1Raw.h).to.include('undefined');
		expect(h1Raw.i).to.include('null');
		expect(h1Raw.j).to.include('NaN');
		expect(h1Raw.k).to.include('true');
		expect(h1Raw.l).to.include('false');
		expect(h1Raw.m).to.include('test');
		expect(h1Raw.n).to.include('1,2');
		expect(h1Raw.n).to.include('3,4');

		expect(h1Raw.z).to.be.undefined;
	});

	it('should wrap headers', () => {
		const h1 = new Headers({
			a: '1'
		});
		const h1Raw = h1.raw();

		const h2 = new Headers(h1);
		h2.set('b', '1');
		const h2Raw = h2.raw();

		const h3 = new Headers(h2);
		h3.append('a', '2');
		const h3Raw = h3.raw();

		expect(h1Raw.a).to.include('1');
		expect(h1Raw.a).to.not.include('2');

		expect(h2Raw.a).to.include('1');
		expect(h2Raw.a).to.not.include('2');
		expect(h2Raw.b).to.include('1');

		expect(h3Raw.a).to.include('1');
		expect(h3Raw.a).to.include('2');
		expect(h3Raw.b).to.include('1');
	});

	it('should accept headers as an iterable of tuples', () => {
		let headers;

		headers = new Headers([
			['a', '1'],
			['b', '2'],
			['a', '3']
		]);
		expect(headers.get('a')).to.equal('1, 3');
		expect(headers.get('b')).to.equal('2');

		headers = new Headers([
			new Set(['a', '1']),
			['b', '2'],
			new Map([['a', null], ['3', null]]).keys()
		]);
		expect(headers.get('a')).to.equal('1, 3');
		expect(headers.get('b')).to.equal('2');

		headers = new Headers(new Map([
			['a', '1'],
			['b', '2']
		]));
		expect(headers.get('a')).to.equal('1');
		expect(headers.get('b')).to.equal('2');
	});

	it('should throw a TypeError if non-tuple exists in a headers initializer', () => {
		expect(() => new Headers([['b', '2', 'huh?']])).to.throw(TypeError);
		expect(() => new Headers(['b2'])).to.throw(TypeError);
		expect(() => new Headers('b2')).to.throw(TypeError);
		expect(() => new Headers({[Symbol.iterator]: 42})).to.throw(TypeError);
	});
});

describe('Response', () => {
	it('should have attributes conforming to Web IDL', () => {
		const res = new Response();
		const enumerableProperties = [];
		for (const property in res) {
			enumerableProperties.push(property);
		}

		for (const toCheck of [
			'body',
			'bodyUsed',
			'arrayBuffer',
			'blob',
			'json',
			'text',
			'url',
			'status',
			'ok',
			'redirected',
			'statusText',
			'headers',
			'clone'
		]) {
			expect(enumerableProperties).to.contain(toCheck);
		}

		for (const toCheck of [
			'body',
			'bodyUsed',
			'url',
			'status',
			'ok',
			'redirected',
			'statusText',
			'headers'
		]) {
			expect(() => {
				res[toCheck] = 'abc';
			}).to.throw();
		}
	});

	it('should support empty options', () => {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const res = new Response(body);
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support parsing headers', () => {
		const res = new Response(null, {
			headers: {
				a: '1'
			}
		});
		expect(res.headers.get('a')).to.equal('1');
	});

	it('should support text() method', () => {
		const res = new Response('a=1');
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support json() method', () => {
		const res = new Response('{"a":1}');
		return res.json().then(result => {
			expect(result.a).to.equal(1);
		});
	});

	it('should support buffer() method', () => {
		const res = new Response('a=1');
		return res.buffer().then(result => {
			expect(result.toString()).to.equal('a=1');
		});
	});

	it('should support blob() method', () => {
		const res = new Response('a=1', {
			method: 'POST',
			headers: {
				'Content-Type': 'text/plain'
			}
		});
		return res.blob().then(result => {
			expect(result).to.be.an.instanceOf(Blob);
			expect(result.size).to.equal(3);
			expect(result.type).to.equal('text/plain');
		});
	});

	it('should support clone() method', () => {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const res = new Response(body, {
			headers: {
				a: '1'
			},
			url: base,
			status: 346,
			statusText: 'production'
		});
		const cl = res.clone();
		expect(cl.headers.get('a')).to.equal('1');
		expect(cl.url).to.equal(base);
		expect(cl.status).to.equal(346);
		expect(cl.statusText).to.equal('production');
		expect(cl.ok).to.be.false;
		// Clone body shouldn't be the same body
		expect(cl.body).to.not.equal(body);
		return cl.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support stream as body', () => {
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const res = new Response(body);
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support string as body', () => {
		const res = new Response('a=1');
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support buffer as body', () => {
		const res = new Response(Buffer.from('a=1'));
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support ArrayBuffer as body', () => {
		const res = new Response(stringToArrayBuffer('a=1'));
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support blob as body', () => {
		const res = new Response(new Blob(['a=1']));
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support Uint8Array as body', () => {
		const res = new Response(new Uint8Array(stringToArrayBuffer('a=1')));
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support DataView as body', () => {
		const res = new Response(new DataView(stringToArrayBuffer('a=1')));
		return res.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should default to null as body', () => {
		const res = new Response();
		expect(res.body).to.equal(null);

		return res.text().then(result => expect(result).to.equal(''));
	});

	it('should default to 200 as status code', () => {
		const res = new Response(null);
		expect(res.status).to.equal(200);
	});

	it('should default to empty string as url', () => {
		const res = new Response();
		expect(res.url).to.equal('');
	});
});

describe('Request', () => {
	it('should have attributes conforming to Web IDL', () => {
		const req = new Request('https://github.com/');
		const enumerableProperties = [];
		for (const property in req) {
			enumerableProperties.push(property);
		}

		for (const toCheck of [
			'body',
			'bodyUsed',
			'arrayBuffer',
			'blob',
			'json',
			'text',
			'method',
			'url',
			'headers',
			'redirect',
			'clone',
			'signal'
		]) {
			expect(enumerableProperties).to.contain(toCheck);
		}

		for (const toCheck of [
			'body', 'bodyUsed', 'method', 'url', 'headers', 'redirect', 'signal'
		]) {
			expect(() => {
				req[toCheck] = 'abc';
			}).to.throw();
		}
	});

	it('should support wrapping Request instance', () => {
		const url = `${base}hello`;

		const form = new FormData();
		form.append('a', '1');
		const {signal} = new AbortController();

		const r1 = new Request(url, {
			method: 'POST',
			follow: 1,
			body: form,
			signal
		});
		const r2 = new Request(r1, {
			follow: 2
		});

		expect(r2.url).to.equal(url);
		expect(r2.method).to.equal('POST');
		expect(r2.signal).to.equal(signal);
		// Note that we didn't clone the body
		expect(r2.body).to.equal(form);
		expect(r1.follow).to.equal(1);
		expect(r2.follow).to.equal(2);
		expect(r1.counter).to.equal(0);
		expect(r2.counter).to.equal(0);
	});

	it('should override signal on derived Request instances', () => {
		const parentAbortController = new AbortController();
		const derivedAbortController = new AbortController();
		const parentRequest = new Request('test', {
			signal: parentAbortController.signal
		});
		const derivedRequest = new Request(parentRequest, {
			signal: derivedAbortController.signal
		});
		expect(parentRequest.signal).to.equal(parentAbortController.signal);
		expect(derivedRequest.signal).to.equal(derivedAbortController.signal);
	});

	it('should allow removing signal on derived Request instances', () => {
		const parentAbortController = new AbortController();
		const parentRequest = new Request('test', {
			signal: parentAbortController.signal
		});
		const derivedRequest = new Request(parentRequest, {
			signal: null
		});
		expect(parentRequest.signal).to.equal(parentAbortController.signal);
		expect(derivedRequest.signal).to.equal(null);
	});

	it('should throw error with GET/HEAD requests with body', () => {
		expect(() => new Request('.', {body: ''}))
			.to.throw(TypeError);
		expect(() => new Request('.', {body: 'a'}))
			.to.throw(TypeError);
		expect(() => new Request('.', {body: '', method: 'HEAD'}))
			.to.throw(TypeError);
		expect(() => new Request('.', {body: 'a', method: 'HEAD'}))
			.to.throw(TypeError);
		expect(() => new Request('.', {body: 'a', method: 'get'}))
			.to.throw(TypeError);
		expect(() => new Request('.', {body: 'a', method: 'head'}))
			.to.throw(TypeError);
	});

	it('should default to null as body', () => {
		const req = new Request('.');
		expect(req.body).to.equal(null);
		return req.text().then(result => expect(result).to.equal(''));
	});

	it('should support parsing headers', () => {
		const url = base;
		const req = new Request(url, {
			headers: {
				a: '1'
			}
		});
		expect(req.url).to.equal(url);
		expect(req.headers.get('a')).to.equal('1');
	});

	it('should support arrayBuffer() method', () => {
		const url = base;
		const req = new Request(url, {
			method: 'POST',
			body: 'a=1'
		});
		expect(req.url).to.equal(url);
		return req.arrayBuffer().then(result => {
			expect(result).to.be.an.instanceOf(ArrayBuffer);
			const str = String.fromCharCode.apply(null, new Uint8Array(result));
			expect(str).to.equal('a=1');
		});
	});

	it('should support text() method', () => {
		const url = base;
		const req = new Request(url, {
			method: 'POST',
			body: 'a=1'
		});
		expect(req.url).to.equal(url);
		return req.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support json() method', () => {
		const url = base;
		const req = new Request(url, {
			method: 'POST',
			body: '{"a":1}'
		});
		expect(req.url).to.equal(url);
		return req.json().then(result => {
			expect(result.a).to.equal(1);
		});
	});

	it('should support buffer() method', () => {
		const url = base;
		const req = new Request(url, {
			method: 'POST',
			body: 'a=1'
		});
		expect(req.url).to.equal(url);
		return req.buffer().then(result => {
			expect(result.toString()).to.equal('a=1');
		});
	});

	it('should support blob() method', () => {
		const url = base;
		const req = new Request(url, {
			method: 'POST',
			body: Buffer.from('a=1')
		});
		expect(req.url).to.equal(url);
		return req.blob().then(result => {
			expect(result).to.be.an.instanceOf(Blob);
			expect(result.size).to.equal(3);
			expect(result.type).to.equal('');
		});
	});

	it('should support arbitrary url', () => {
		const url = 'anything';
		const req = new Request(url);
		expect(req.url).to.equal('anything');
	});

	it('should support clone() method', () => {
		const url = base;
		let body = resumer().queue('a=1').end();
		body = body.pipe(new stream.PassThrough());
		const agent = new http.Agent();
		const {signal} = new AbortController();
		const req = new Request(url, {
			body,
			method: 'POST',
			redirect: 'manual',
			headers: {
				b: '2'
			},
			follow: 3,
			compress: false,
			agent,
			signal
		});
		const cl = req.clone();
		expect(cl.url).to.equal(url);
		expect(cl.method).to.equal('POST');
		expect(cl.redirect).to.equal('manual');
		expect(cl.headers.get('b')).to.equal('2');
		expect(cl.follow).to.equal(3);
		expect(cl.compress).to.equal(false);
		expect(cl.method).to.equal('POST');
		expect(cl.counter).to.equal(0);
		expect(cl.agent).to.equal(agent);
		expect(cl.signal).to.equal(signal);
		// Clone body shouldn't be the same body
		expect(cl.body).to.not.equal(body);
		return Promise.all([cl.text(), req.text()]).then(results => {
			expect(results[0]).to.equal('a=1');
			expect(results[1]).to.equal('a=1');
		});
	});

	it('should support ArrayBuffer as body', () => {
		const req = new Request('', {
			method: 'POST',
			body: stringToArrayBuffer('a=1')
		});
		return req.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support Uint8Array as body', () => {
		const req = new Request('', {
			method: 'POST',
			body: new Uint8Array(stringToArrayBuffer('a=1'))
		});
		return req.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});

	it('should support DataView as body', () => {
		const req = new Request('', {
			method: 'POST',
			body: new DataView(stringToArrayBuffer('a=1'))
		});
		return req.text().then(result => {
			expect(result).to.equal('a=1');
		});
	});
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

describe('external encoding', () => {
	describe('data uri', () => {
		it('should accept data uri', () => {
			return fetch('data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=').then(r => {
				expect(r.status).to.equal(200);
				expect(r.headers.get('Content-Type')).to.equal('image/gif');

				return r.buffer().then(b => {
					expect(b).to.be.an.instanceOf(Buffer);
				});
			});
		});

		it('should accept data uri of plain text', () => {
			return fetch('data:,Hello%20World!').then(r => {
				expect(r.status).to.equal(200);
				expect(r.headers.get('Content-Type')).to.equal('text/plain');
				return r.text().then(t => expect(t).to.equal('Hello World!'));
			});
		});

		it('should reject invalid data uri', () => {
			return fetch('data:@@@@').catch(e => {
				expect(e).to.exist;
				expect(e.message).to.include('invalid URL');
			});
		});
	});
});
