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
  console.log('Error in Promise:', new Error(err))
})

/////////////////////////////////////////////////////////

const path = require('path')

const express = require('express')
const session = require('express-session')
const sessionStore = require('session-file-store')(session)
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

app.set('trust proxy', 1)
app.set('json spaces', 2)

app.use(session({
  secret: 'thisandagainplsexplain',
  cookie: { secure: true },
  resave: false,
  saveUninitialized: true,
  store: new sessionStore({
    path: 'db/session',
    logFn: ()=>{}
  })
}))

/////////////////////////////////////////////////////////

app.get('/assets/:type/*', function(req, res) {
  res.sendFile(
    path.join(__dirname, '../../', `public/assets/${req.params.type}/.dist/${req.params[0]}`)
  )
})

app.get('/join', async function(req, res) {
  // if already signed in, skip
  if(req.session.user)
    res.redirect(req.query.r || '/')

  res.render('join', {
    user: req.session.user
  })
})

app.post('/join', async function(req, res) {
  res.redirect(req.query.r || '/')
})

app.get('/', function(req, res) {
  res.render('index', {
    user: req.session.user
  })
})

/////////////////////////////////////////////////////////

app.listen(3000, function() {
  console.log('Listening on http://localhost:3000')
})

// temp. obviously
db.user.join({
  username: 'thisandagain',
  password: 'plsexplain',
  email: 'bob@scratch.mit.edu'
})
