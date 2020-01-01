import generate from 'nanoid/generate';

const alpha = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * @api private
 */
const boundary = () => generate(alpha, 22);

export default boundary;
