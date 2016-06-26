/**
 * server/main.js
 * --------------
 * 
 * The server. Obviously.
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

require('source-map-support').install()

process.on('unhandledRejection', function(err) {
  console.log(new Error(err))
})

/////////////////////////////////////////////////////////

const path = require('path')

const express = require('express')
const exprhbs = require('express-handlebars')

const db = require('../db')

/////////////////////////////////////////////////////////

let app = express()

app.engine('hbs', exprhbs({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: 'public/views/layouts/',
  partialsDir: 'public/views/partials/'
}))

app.set('views', 'public/views')
app.set('view engine', 'hbs')

app.set('json spaces', 2)

/////////////////////////////////////////////////////////

app.get('/assets/:type/*', function(req, res) {
  res.sendFile(
    path.join(__dirname, '../../', `public/assets/${req.params.type}/.dist/${req.params[0]}`)
  )
})

app.get('/dump/users', async function(req, res) {
  let users = await db.users.get(true)

  await db.user.join({
    username: 'thisandagain',
    password: 'plsexplain',
    email: 'satan@scratch.mit.edu'
  })

  let signedIn = await db.user.signIn('thisandagain', 'plsexplain')
  console.log(signedIn)

  res.json(users)
})

app.get('/', function(req, res) {
  res.render('index')
})

/////////////////////////////////////////////////////////

app.listen(3000, function() {
  console.log('Listening on http://localhost:3000')
})