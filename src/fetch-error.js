
/**
 * fetch-error.js
 *
 * FetchError interface for operational errors
 */

/**
 * Create FetchError instance
 *
 * @param   String      message      Error message for human
 * @param   String      type         Error type for machine
 * @param   String      systemError  For Node.js system error
 * @return  FetchError
 */
class FetchError extends Error {
	constructor(message, type, systemError) {
		super(message);
		
		// hide custom error implementation details from end-users
		Error.captureStackTrace(this, this.constructor);

		this.name = this.constructor.name;
		this.type = type;

		// when err.type is `system`, err.code contains system error code
		if (systemError) {
			this.code = this.errno = systemError.code;
		}
	}
}

export default FetchError;
