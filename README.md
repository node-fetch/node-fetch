
node-fetch
==========

[![npm version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]

A light-weight module that brings window.fetch to node.js


# Motivation

I really like the notion of Matt Andrews' [isomorphic-fetch](https://github.com/matthew-andrews/isomorphic-fetch): it bridges the API gap between client-side and server-side http requests, so developers have less to worry about.

But I think the term [isomorphic](http://isomorphic.net/) is generally misleading: it gives developers a false impression that their javascript code will happily run on both controlled server environment as well as uncontrollable user browsers. When the latter is only true for a subset of modern browsers, not to mention browser quirks.

Plus if you are going all the way to implement `XMLHttpRequest` in node and then promisify it, why not go from node's `http` to `fetch` API directly? Your browserify build are going to be vastly different from node anyway.


# Features

* Stay consistent with `window.fetch` API.
* Make conscious trade-off when following [WHATWG fetch spec](https://fetch.spec.whatwg.org/) implementation details, document known difference.
* Use native promise, but allow substituting it with [insert your favorite promise library].


# Install

`npm install node-fetch --save`


# Usage

TODO


# Limit

TODO


# License

MIT

[npm-image]: https://img.shields.io/npm/v/node-fetch.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/node-fetch
[travis-image]: https://img.shields.io/travis/bitinn/node-fetch.svg?style=flat-square
[travis-url]: https://travis-ci.org/bitinn/node-fetch
