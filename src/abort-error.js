/**
 * Abort-error.js
 *
 * AbortError interface for cancelled requests
 */

/**
 * Create AbortError instance
 *
 * @param   String      message      Error message for human
 * @return  AbortError
 */
export default class AbortError extends Error {
	constructor(message) {
		super(message);

		this.type = 'aborted';
		this.message = message;
		this.name = 'AbortError';

		// Hide custom error implementation details from end-users
		Error.captureStackTrace(this, this.constructor);
	}
}
