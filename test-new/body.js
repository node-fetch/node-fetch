import test from 'ava';

import Body from '../src/body.js';

test('should support arrayBuffer(), blob(), text(), json() and buffer() method in Body constructor', t => {
	const body = new Body('a=1');
	const enumerableProperties = [];

	// eslint-disable-next-line guard-for-in
	for (const property in body) {
		enumerableProperties.push(property);
	}
	const toCheck = [
		'arrayBuffer',
		'blob',
		'text',
		'json',
		'text'
	];

	t.assert(body.buffer)
	for (const property of toCheck) {
		t.is(enumerableProperties.includes(property), true);
	};
});
