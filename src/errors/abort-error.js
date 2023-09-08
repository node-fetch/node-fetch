import {FetchBaseError} from './base.js';

/**
 * AbortError interface for cancelled requests
 */
export class AbortError extends FetchBaseError {
	constructor(message, reason) {
		super(message, 'aborted');

		this.reason = reason;
	}
}
