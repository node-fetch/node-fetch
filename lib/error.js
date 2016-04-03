/**
 * error.js
 *
 * Helper function for creating Error with a code
 */

module.exports = error;

/**
 * Create Error
 *
 * @param   String  reason  String code
 * @return  Error
 */
function error(reason, code) {
  var error = new Error(reason);
  error.code = code;
  return error;
}
