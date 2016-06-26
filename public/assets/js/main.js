/**
 * js/main.js
 * ----------
 * 
 * The main website script.
 */

require('traceur/bin/traceur-runtime')
require('traceur').require.makeDefault(f => f.indexOf('node_modules') === -1, {
  experimental: true,
  properTailCalls: true,
  symbols: true,
  arrayComprehension: true,
  asyncFunctions: true,
  asyncGenerators: true,
  forOn: true,
  generatorComprehension: true
})

/////////////////////////////////////////////////////////

const $ = require('jquery')
console.log('hello world')