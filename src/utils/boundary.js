// ? I don't know if it necessary here, but thios module might cause errors in CRA
// ? See: https://github.com/ai/nanoid/issues/205
// ? If anything happens, we could replace it with something else
import {customAlphabet} from 'nanoid';

const alpha = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * @api private
 */
const boundary = customAlphabet(alpha, 22);

export default boundary;
