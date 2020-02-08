/*
Copyright 2019-2020 Netfoundry, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const SESSION_COOKIES = Symbol('Session cookies');

export default class SessionCookies {

	constructor() {
		this[SESSION_COOKIES] = {};
	}
	put(cookie) {
		this[SESSION_COOKIES][cookie.name] = cookie;
	}
	getValue(cookie) {
		return this[SESSION_COOKIES][cookie.name].value;
	}
	delete(cookie) {
		this[SESSION_COOKIES][cookie.name] = null;
	}
	getAll() {
		return this[SESSION_COOKIES];
	}
	get(key) {
		return this[SESSION_COOKIES][key];
	}
	hasOwnProperty(key) {
		return this[SESSION_COOKIES].hasOwnProperty(key);
	}
	isEmpty() {
		for (const key in this[SESSION_COOKIES]) {
			if (this[SESSION_COOKIES].hasOwnProperty(key)) {
			  	return false;
			  }
		}
		return true;
	}
	toString() {
		return '[object SessionCookies]'
	}
}

Object.defineProperties(SessionCookies.prototype, {
	size: { enumerable: true },
	type: { enumerable: true },
	slice: { enumerable: true }
});

Object.defineProperty(SessionCookies.prototype, Symbol.toStringTag, {
	value: 'SessionCookies',
	writable: false,
	enumerable: false,
	configurable: true
});
