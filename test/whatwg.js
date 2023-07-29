import https from 'node:https'
import { createBrotliDecompress } from 'node:zlib'
import assert from 'node:assert'
import { json } from 'stream-consumers'
import { Blob } from '../src/index.js'
import {
  Readable,
  Duplex,
  DecompressionStream,
  whatwg
} from '../src/utils/streams.js'

/** @typedef {import('http').IncomingMessage} IncomingMessage */

/** @type {(url: string) => Promise<IncomingMessage>} */
const get = url => new Promise(rs => https.get(url, rs))

describe('testing whatwg streams', () => {
  it('should handle non compressed data', async () => {
    const iterable = await get('https://httpbin.org/get').then(Readable.toWeb)
    const data = await json(iterable)
    assert(typeof data === 'object')
  })

  it('should decompress gzip', async () => {
    const ts = new DecompressionStream('gzip')
    const readable = await get('https://httpbin.org/gzip').then(Readable.toWeb)
    const data = await json(readable.pipeThrough(ts))
    assert(typeof data === 'object')
  })

  it('should decompress deflate', async () => {
    const ts = new DecompressionStream('deflate')
    const readable = await get('https://httpbin.org/deflate').then(Readable.toWeb)
    const data = await json(readable.pipeThrough(ts))
    assert(typeof data === 'object')
  })

  it('should decompress br', async () => {
    const ts = Duplex.toWeb(createBrotliDecompress())
    const readable = await get('https://httpbin.org/brotli').then(Readable.toWeb)
    const data = await json(readable.pipeThrough(ts))
    assert(typeof data === 'object')
  })

  it('should be able to pipe a blob and read it', async () => {
    const chunks = []
    await new Blob(['abc'])
      .stream()
      .pipeTo(new whatwg.WritableStream({
        write (chunk) {
          chunks.push(...chunk)
        }
      }))
    assert.deepEqual(chunks, [97, 98, 99])
  })
})
