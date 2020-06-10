
import * as stream from 'stream';
import chai from 'chai';
import stringToArrayBuffer from 'string-to-arraybuffer';
import Blob from 'fetch-blob';
import {Response} from '../src/index.js';
import TestServer from './utils/server.js';

const {expect} = chai;

const local = new TestServer();
const base = `http://${local.hostname}:${local.port}/`;

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
		const res = new Response(stream.Readable.from('a=1'));
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
		const body = stream.Readable.from('a=1');
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
		const body = stream.Readable.from('a=1');
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
