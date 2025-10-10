import {
  nodeResolve
} from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import dts from 'rollup-plugin-dts'
import JSON from '@rollup/plugin-json'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import alias from '@rollup/plugin-alias'

function getPlugins () {
  return [
    nodeResolve(),
    commonjs(),
    JSON(),
    typescript({
      exclude: 'node_modules/**',
      typescript: require('typescript')
    }),
    alias({
      entries: [
        { find: '@src', replacement: '/src' },
        { find: '@type', replacement: '/types' }
      ]
    })

  ]
}

function getExternal () {
  return []
}

function getGlobals () {
  return {
    React: 'react',
    ReactDOM: 'react-dom'
  }
}

function genRollupConfig (module) {
  return {
    input: `./src/${module.input}`,
    output: [{
      exports: 'auto',
      format: 'cjs',
      file: `lib/${module.output}`,
      globals: getGlobals()
    }],
    watch: {
      include: 'src/**'
    },
    plugins: getPlugins(),
    external: getExternal()
  }
}

const moduleNames = [
  {
    name: 'index',
    input: 'index.ts',
    output: 'main/index.js'
  }
]

export default () => {
  const config = moduleNames.map((module) => {
    return genRollupConfig(module)
  })

  if (process.env.NODE_ENV === 'production') {
    config.forEach(val => {
      val.plugins.push(
        terser({
          mangle: true,
          output: {
            comments: /@COMPILER_INJECT/i
          }
        }))
    })
    config.push({
      input: './src/index.ts',
      output: [{ file: 'lib/types/index.d.ts', format: 'es' }],
      plugins: [dts()]
    })
  }

  return config
}
