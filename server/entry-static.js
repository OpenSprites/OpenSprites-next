// use when you have traceur pre-compile all the scripts
// eg with npm run build-server-static
console.log("OpenSprites: Using static traceur build")

require('source-map-support').install()
require('traceur/bin/traceur-runtime')

process.on('unhandledRejection', function(err) {
  console.error(err)
})

require('./main')