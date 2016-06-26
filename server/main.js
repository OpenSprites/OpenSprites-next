/**
 * server/main.js
 * --------------
 * 
 * The server. Obviously.
 */

require('source-map-support').install()

/////////////////////////////////////////////////////////

const path = require('path')

const express = require('express')
const exprhbs = require('express-handlebars')

/////////////////////////////////////////////////////////

let app = express()

app.set('views', 'public/views')

app.engine('hbs', exprhbs({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: 'public/views/layouts/',
  partialsDir: 'public/views/partials/'
}))

app.set('view engine', 'hbs')

/////////////////////////////////////////////////////////

app.get('/assets/:type/:asset', function(req, res) {
  res.sendFile(
    path.join(__dirname, '../../', `public/assets/${req.params.type}/.dist/${req.params.asset}`)
  )
})

app.get('/', function(req, res) {
  res.render('index')
})

/////////////////////////////////////////////////////////

app.listen(3000, function() {
  console.log('Listening on http://localhost:3000')
})