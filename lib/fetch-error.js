/**
 * fetch-error.js
 *
 * FetchError class for operational errors
 */

module.exports = FetchError;

/**
 * Create FetchError
 *
 * @param   String  reason  String type	Error optionalSystemError
 * @return  FetchError
 */
function FetchError(message, type, optionalSystemError) {
	Error.captureStackTrace(this, this.constructor);
	this.name = this.constructor.name;
	this.message = message;
	this.type = type;
	if (optionalSystemError) {
		this.code = this.errno = optionalSystemError.code;
	}
}

require('util').inherits(FetchError, Error);
