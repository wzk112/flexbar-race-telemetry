import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'

const pluginDirectory = 'com.zikai.racetelemetry.plugin'

export default {
  input: 'src/plugin.cjs',
  output: {
    file: `${pluginDirectory}/backend/plugin.cjs`,
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    json(),
    nodeResolve({
      browser: false,
      exportConditions: ['node'],
      preferBuiltins: true
    }),
    commonjs()
  ],
  external: [
    '@napi-rs/canvas',
    /^node:/
  ]
}
