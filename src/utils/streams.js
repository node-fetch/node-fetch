import process from 'node:process'
import stream from 'node:stream'
import zlib from 'node:zlib'
import eos from 'end-of-stream'

const { emitWarning } = process
process.emitWarning = () => { }
const { default: _, DecompressionStream = zlib.createUnzip, ...whatwg } = (
  /** @type {import('node:stream/web')} */
  (await import('node:stream/web').catch(_ =>
    import('web-streams-polyfill/dist/ponyfill.es2018.js')
  ))
)
process.emitWarning = emitWarning

class Duplex extends stream.Duplex {
  /** @param {Duplex} duplex */
  toWeb (duplex) {
    return {
      writable: Writable.toWeb(duplex),
      readable: Readable.toWeb(duplex)
    }
  }
}

function defer () {
  const q = {}
  q.promise = new Promise((rs, rj) => {
    q.resolve = rs
    q.reject = rj
  })
  return q
}

// Have been end():d.
function isWritableEnded (stream) {
  if (stream.writableEnded === true) return true
  const wState = stream._writableState
  if (wState?.errored) return false
  if (typeof wState?.ended !== 'boolean') return null
  return wState.ended
}

class Writable extends stream.Writable {
  /** @param {stream.Writable} writable */
  toWeb (writable) {
    let q
    let closed

    return new whatwg.WritableStream({
      start (controller) {
        const cleanup = eos(writable, error => {
          cleanup()
          if (error != null) {
            if (q) q.reject(error)
            // If closed is not undefined, the error is happening
            // after the WritableStream close has already started.
            // We need to reject it here.
            if (closed !== undefined) {
              closed.reject(error)
              closed = undefined
            }
            controller.error(error)
            controller = undefined
            return
          }

          if (closed) {
            closed.resolve()
            closed = undefined
            return
          }
          controller.error(error)
          controller = undefined
        })

        writable.on('drain', () => {
          if (q) q.resolve()
        })
      },

      async write (chunk) {
        if (writable.writableNeedDrain || !writable.write(chunk)) {
          q = defer()
          return q.promise.finally(() => {
            q = undefined
          })
        }
      },

      abort (reason) {
        writable.destroy(reason)
      },

      close () {
        if (!closed && !isWritableEnded(writable)) {
          closed = defer()
          writable.end()
          return closed.promise
        }

        return Promise.resolve()
      }
    }, { highWaterMark: writable.writableHighWaterMark })
  }
}

class Readable extends stream.Readable {
  /** @param {stream.Readable} readable */
  static toWeb (readable) {
    return new whatwg.ReadableStream({
      start (controller) {
        readable.pause()
        const cleanup = eos(readable, error => {
          cleanup()
          error ? controller.error(error) : controller.close()
        })

        readable.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk))
          if (controller.desiredSize <= 0) readable.pause()
        })
      },
      pull () { readable.resume() },
      cancel (reason) { readable.destroy(reason) }
    }, {
      highWaterMark: readable.readableHighWaterMark
    })
  }
}

// Use built-in Node.js stuff if available
Readable.toWeb = stream.Readable.toWeb || Readable.toWeb
Writable.toWeb = stream.Writable.toWeb || Writable.toWeb
Duplex.toWeb = stream.Duplex.toWeb || Duplex.toWeb

export {
  DecompressionStream,
  Readable,
  Writable,
  Duplex,
  whatwg
}
