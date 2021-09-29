import {FormData as FormDataNode} from 'formdata-node';
import {FormData} from 'formdata-polyfill/esm.min.js';
import {Blob} from 'fetch-blob/from.js';
import chai from 'chai';
import {Request, Response} from '../src/index.js';

const {expect} = chai;

describe('FormData', () => {
	it('Consume empty URLSearchParams as FormData', async () => {
		const res = new Response(new URLSearchParams());
		const fd = await res.formData();

		expect(fd).to.be.instanceOf(FormData);
	});

	it('Consume empty URLSearchParams as FormData', async () => {
		const req = new Request('about:blank', {
			method: 'POST',
			body: new URLSearchParams()
		});
		const fd = await req.formData();

		expect(fd).to.be.instanceOf(FormData);
	});

	it('Consume empty response.formData() as FormData', async () => {
		const res = new Response(new FormData());
		const fd = await res.formData();

		expect(fd).to.be.instanceOf(FormData);
	});

	it('Consume empty response.formData() as FormData', async () => {
		const res = new Response(new FormData());
		const fd = await res.formData();

		expect(fd).to.be.instanceOf(FormData);
	});

	it('Consume empty request.formData() as FormData', async () => {
		const req = new Request('about:blank', {
			method: 'POST',
			body: new FormData()
		});
		const fd = await req.formData();

		expect(fd).to.be.instanceOf(FormData);
	});

	it('Consume URLSearchParams with entries as FormData', async () => {
		const res = new Response(new URLSearchParams({foo: 'bar'}));
		const fd = await res.formData();

		expect(fd.get('foo')).to.be.equal('bar');
	});

	it('should return a length for empty form-data', async () => {
		const form = new FormData();
		const ab = await new Request('http://a', {
			method: 'post',
			body: form
		}).arrayBuffer();

		expect(ab.byteLength).to.be.greaterThan(30);
	});

	it('should add a Blob field\'s size to the FormData length', async () => {
		const form = new FormData();
		const string = 'Hello, world!';
		form.set('field', string);
		const fd = await new Request('about:blank', {method: 'POST', body: form}).formData();
		expect(fd.get('field')).to.equal(string);
	});

	it('should return a length for a Blob field', async () => {
		const form = new FormData();
		const blob = new Blob(['Hello, world!'], {type: 'text/plain'});
		form.set('blob', blob);

		const fd = await new Response(form).formData();

		expect(fd.get('blob').size).to.equal(13);
	});

	it('FormData-node still works thanks to symbol.hasInstance', async () => {
		const form = new FormDataNode();
		form.append('file', new Blob(['abc'], {type: 'text/html'}));
		const res = new Response(form);
		const fd = await res.formData();

		expect(await fd.get('file').text()).to.equal('abc');
		expect(fd.get('file').type).to.equal('text/html');
	});
});
