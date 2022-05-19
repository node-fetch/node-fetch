/**
 * similar with `src.pipe(dst)`, except `src` will be destroyed when `dst` emit error
 */
 export const pipeAndDestroy = (src, dst) => {
   dst.on('error', (err) => {
     src.destroy(err);
   });
   return src.pipe(dst);
};
