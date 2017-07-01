import isBuiltin from 'is-builtin-module';
import babel from 'rollup-plugin-babel';
import tweakDefault from './build/rollup-plugin';

process.env.BABEL_ENV = 'rollup';

export default {
  entry: 'src/index.js',
  exports: 'named',
  plugins: [
    babel({
      runtimeHelpers: true
    }),
    tweakDefault()
  ],
  targets: [
    { dest: 'lib/index.js', format: 'cjs' },
    { dest: 'lib/index.es.js', format: 'es' }
  ],
  external: function (id) {
    if (isBuiltin(id)) {
      return true;
    }
    id = id.split('/').slice(0, id[0] === '@' ? 2 : 1).join('/');
    return !!require('./package.json').dependencies[id];
  }
};
