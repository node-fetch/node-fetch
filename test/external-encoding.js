import fetch from '../src/index.js';
import chai from 'chai';

const {expect} = chai;

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
			return fetch('data:@@@@').catch(error => {
				expect(error).to.exist;
				expect(error.message).to.include('invalid URL');
			});
		});
	});
});
