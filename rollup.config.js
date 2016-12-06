import isBuiltin from 'is-builtin-module';
import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';

process.env.BABEL_ENV = 'rollup';

export default {
  entry: 'src/index.js',
  plugins: [
    babel({
      runtimeHelpers: true
    })
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
