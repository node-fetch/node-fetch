import test from 'ava';

import {FetchError} from '../src/index.js';
import * as FetchErrorOrig from '../src/errors/fetch-error.js';

test('should expose FetchError constructor', t => {
	t.is(FetchError, FetchErrorOrig.FetchError);
});

test('error should contain system error if one occurred', t => {
	const err = new FetchError('a message', 'system', new Error('an error'));
	t.true(err.hasOwnProperty('erroredSysCall'));
});

test('error should not contain system error if none occured', t => {
	const err = new FetchError('a message', 'a type');
	t.false(err.hasOwnProperty('errroredSysCall'));
});

/* eslint-disable-next-line func-names */
test('should create custom FetchError', function funcName (t) {
	const systemError = new Error('system');
	systemError.code = 'ESOMEERROR';

	const err = new FetchError('test message', 'test-error', systemError);
	t.true(err instanceof Error);
	t.true(err instanceof FetchError);
	t.is(err.name, 'FetchError');
	t.is(err.message, 'test message');
	t.is(err.type, 'test-error');
	t.is(err.code, 'ESOMEERROR');
	t.is(err.errno, 'ESOMEERROR');
	// Reading the stack is quite slow (~30-50ms)
	t.true((err.stack.includes('funcName') && err.stack.startsWith(`${err.name}: ${err.message}`)));
});
