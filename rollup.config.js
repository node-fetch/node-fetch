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
  ]
};
