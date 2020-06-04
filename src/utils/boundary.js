import {randomBytes} from 'crypto'

/**
 * @api private
 */
const boundary = () => randomBytes(8).toString('hex');

export default boundary;
