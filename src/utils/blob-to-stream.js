import {Readable} from 'stream';

/* c8 ignore start */
async function * read(blob) {
	let position = 0;
	while (position !== blob.size) {
		const chunk = blob.slice(position, Math.min(blob.size, position + 524288));
		// eslint-disable-next-line no-await-in-loop
		const buffer = await chunk.arrayBuffer();
		position += buffer.byteLength;
		yield new Uint8Array(buffer);
	}
}
/* c8 ignore end */

export function blobToNodeStream(blob) {
	return Readable.from(blob.stream ? blob.stream() : read(blob), {
		objectMode: false
	});
}
