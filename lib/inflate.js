
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

	var self = this;

	self.options = options;
	self.inflate = zlib.createInflate(options);

	self.buffer = [];
	self.willSwitch = true;
	self.isFinished = false;

	self.inflate.on('data', onInflateData);
	self.inflate.once('error', onInflateError);
	self.inflate.once('end', onInflateEnd);
	self.once('finish', onTransformFinish);

	/**
	 * Inflate data callback
	 *
	 * @param   Buffer   data   Decoded data from inflate 
	 */
	function onInflateData(data) {
		self.willSwitch = false;
		self.buffer = null;
		self.push(data);
	}

	/**
	 * Inflate error callback
	 *
	 * @param   Error   error 
	 */
	function onInflateError(error) {

		// pass through errors if we're not going to switch to inflateRaw
		if (!self.willSwitch) {
			self.emit('error', error);
			return;
		}

		// replace inflate with inflateRaw
		self.inflate.removeListener('data', onInflateData);
		self.inflate.removeListener('end', onInflateEnd);

		self.inflate = zlib.createInflateRaw(options);

		self.inflate.on('data', onInflateData);
		self.inflate.on('error', onInflateError);
		self.inflate.on('end', onInflateEnd);

		// write buffer data
		self.buffer.forEach(function(data) {
			self.inflate.write(data.chunk, data.encoding);
		});

		if (self.isFinished) {
			self.inflate.end();
		}

		this.willSwitch = false;
		this.buffer = null;

		self.emit('switchRaw');
	}

	/**
	 * Inflate end callback 
	 */
	function onInflateEnd() {
		self.push(null);
	}

	/**
	 * Transform finish callback
	 */
	function onTransformFinish() {
		self.willSwitch = false;
		self.inflate.end();
	}

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
	if (self.willSwitch) {
		self.buffer.push({ chunk: chunk, encoding: encoding });
		self.once('switchRaw', callback);
	}
	self.inflate.write(chunk, encoding, function() {
		self.removeListener('switchRaw', callback);
		callback();
	});
};

/**
 * Transform's _flush callback
 *
 * @param   Function   callback  Callback when finish flushing
 */
Inflate.prototype._flush = function(callback) {
	var self = this;
	if (self.willSwitch) {
		self.once('switchRaw', callback);
	}
	self.inflate.end(function() {
		self.removeListener('switchRaw', callback);
		callback();
	});
};
