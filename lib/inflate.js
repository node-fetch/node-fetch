
/**
 * inflate.js
 */

var zlib = require('zlib');
var stream = require('stream');

module.exports = Inflate;

/**
 * Create Inflate instance
 *
 * @param   Object      options      Options for creating Inflate object
 * @return  Inflate
 */
function Inflate(options) {
	stream.Transform.call(this);
	this.options = options;
	this.inflate = null;
}

require('util').inherits(Inflate, stream.Transform);

/**
 * Transform's _transform callback
 *
 * @param   Buffer    chunk     The chunk to be transformed
 * @param   string    encoding  Encoding type of chunk
 * @param   Function  callback  Callback when finish processing chunk
 */
Inflate.prototype._transform = function(chunk, encoding, callback) {
	var self = this;

	if (!self.inflate) {

		// check if the stream has a header, see http://stackoverflow.com/a/37528114
		if ((new Buffer(chunk, encoding)[0] & 0x0F) === 0x08) {
			self.inflate = zlib.createInflate(self.options);
		} else {
			self.inflate = zlib.createInflateRaw(self.options);
		}

		self.once('finish', function() {
			self.inflate.end();
		});
		self.inflate.on('data', function(chunk) {
			self.push(chunk);
		});
		self.inflate.on('error', function(error) {
			self.emit('error', error);
		});
		self.inflate.once('end', function() {
			self.isInflateEnded = true;
			self.push(null);
		});

	}

	self.inflate.write(chunk, encoding, callback);
};

/**
 * Transform's _flush callback
 *
 * @param   Function   callback  Callback when finish flushing
 */
Inflate.prototype._flush = function(callback) {
	if (this.inflate && !this.isInflateEnded) {
		this.inflate.once('end', callback);
	} else {
		callback();
	}
};
