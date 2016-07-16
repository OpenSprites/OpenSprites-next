require('source-map-support').install()
require('traceur/bin/traceur-runtime')
require('traceur').require.makeDefault(f => f.indexOf('node_modules') === -1, {
  experimental: true,
  properTailCalls: false,
  symbols: true,
  arrayComprehension: true,
  asyncFunctions: true,
  asyncGenerators: true,
  forOn: true,
  generatorComprehension: true,
  sourceMaps: 'inline'
})

process.on('unhandledRejection', function(err) {
  console.error(err)
})

require('../main.js')