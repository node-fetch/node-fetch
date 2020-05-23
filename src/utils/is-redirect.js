// https://onlinewritingtraining.com.au/plural-of-status/
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/**
 * Redirect code matching
 *
 * @param {number} code - Status code
 * @return {boolean}
 */
export function isRedirect(code) {
	return REDIRECT_STATUS.has(code);
}
