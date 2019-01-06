# Increasing clone highWaterMark

## The Problem

When using `res.clone` method it might happen that you want process either the original body or the cloned body first:

```js
fetch(url)
  .then(res => cache.put(url, res.clone()))
  .then(res => res.json())
  ...
```

The original response waits for the cloned response to be completed. That means the whole response is buffered in a memory during the first `than` statement. With big response sizes that might lead to consuming too much of the precious server resources.

To keep app allocated memory low, Node.js provides [`highWaterMark` limit of stream internal buffer][hwm]. It defaults to 16kB for all streams but can be overridden explicitly.

The problem is that the code above freezes and times out for larger response sizes. Nobody consumes the original response stream leading to accumulation of data in it's buffers. When `highWaterMark` limits are hit a mechanism called [backpressure] kicks in. As a result, data will stop flowing, endlessly waiting for the original response to signal it can take more.

1. At the beginning 6 packets are ready to be transmitted.

	```
	  Data                        Original
	+-------------+             +-----------+
	| O O O O O O +-----+------>+           | X
	+-------------+     |       +-----------+
	                    |
	                    |         Cloned
	                    |       +-----------+
	                    +------>+           +---->
	                            +-----------+
	```

2. 2 chunks passed to both streams.

	```
	  Data                        Original
	+-------------+             +-----------+
	|     O O O O +-----+------>+ O O       | X
	+-------------+     |       +-----------+
	                    |
	                    |         Cloned
	                    |       +-----------+
	                    +------>+ O O       +---->
	                            +-----------+
	```

3. 5 chunks passed to both streams. The original one triggers backpressure. Source of data stops until notification that it can send more.

	```
	  Data                        Original
	+-------------+             +-----------+
	|           O +-----+------>+ O O O O O | X
	+-------------+     |       +-----------+
	                    |
	                    |         Cloned
	                    |       +-----------+
	                    +------>+ O O O O O +---->
	                            +-----------+
	```

4. Chunks in the cloned stream reaches their destination. But the flow stopped. The last chunk won't be transmitted.

	```
	  Data                        Original
	+-------------+             +-----------+
	|           O +-----+------>+ O O O O O | X
	+-------------+     |       +-----------+
	                    |
	                    |         Cloned
	                    |       +-----------+
	                    +------>+            +---->
	                            +-----------+
	```

There are few inaccuracies in diagrams above for the sake of simplification.

[hwm]: https://nodejs.org/api/stream.html#stream_buffering
[backpressure]: https://nodejs.org/en/docs/guides/backpressuring-in-streams/

## The Solution

Set bigger `highWaterMark` limit by passing a value to `clone` method:

```js
res.clone(40 * 1024)
```

Use `expected_maximal_request_size / 2 + 1` as the value.

Don't forget that the whole response still goes into memory. Calculate carefully not to deplete all your server memory with few requests.


### Why

The cloned body is in fact a Node.js [*PassThrough*][passthrough] stream. *PassThrough* streams have two buffers with the same `highWaterMark`, one for [*Writable*][writable] stream on the input and on for [*Readable*][readable] stream on output. It can contain **double the value of `highWaterMark`**.

When `highWateMark` of the *Writeable* stream is reached, the stream writing data stops. Increasing the value by **a single byte** is sufficient to avoid that.

In fact, streams can take much more data. `highWaterMark` is [not a limit][] really. It is rather just a mark as the name suggests. Backpressure kicks in when data written [reaches **or overflows**][highwatermark-check] `highWaterMark` value. With two buffers of *PassThrough*, the **first chunk can have any size**. Well, almost any size. A TCP packet maximum size is [64kB], so this is the most common chunk size when dealing with large HTTP responses.

But to avoid the backpressure, when chunks fill in the second buffer without any overflow by chance, we need to make sure the first buffer won't get to the `highWaterMark`. Hence the ½ + 1 limit.

[passthrough]: https://nodejs.org/api/stream.html#stream_class_stream_passthrough
[writable]: https://nodejs.org/api/stream.html#stream_writable_streams
[readable]: https://nodejs.org/api/stream.html#stream_readable_streams
[not a limit]: https://stackoverflow.com/a/45905930/5763764
[highwatermark-check]: https://github.com/nodejs/node/blob/master/lib/_stream_writable.js#L378
[64kB]: https://stackoverflow.com/a/2614188/5763764
