/**
 * server/main.js
 * --------------
 * 
 * The server. Obviously.
 */

require('traceur/bin/traceur-runtime') 
require('traceur').require.makeDefault(f => f.indexOf('node_modules') === -1, { 
  experimental: true, 
  properTailCalls: false, 
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
const bodyParser = require('body-parser')
const session = require('express-session')
const sessionStore = require('session-file-store')(session)
const exprhbs = require('express-handlebars')

const uniqid = require('uniqid').process
const cheerio = require('cheerio')
const request = require('request-promise')

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
  cookie: { secure: false }, // enable if running on HTTPS
  resave: true,
  saveUninitialized: true,
  store: new sessionStore({
    path: 'db/session',
    logFn: ()=>{}
  })
}))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

function mustSignIn(req, res, next) {
  if(req.session.user)
    next()
  else {
    req.session.r = req.originalUrl
    res.redirect('/signin')
  }
}

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

  req.session.joinCode = req.session.joinCode || uniqid()

  res.render('join', {
    user: req.session.user,
    title: 'Join',

    code: req.session.joinCode,
    fail: req.session.joinFailWhy,
    already: req.session.join || {}
  })

  delete req.session.joinFailWhy
})

app.post('/join', async function(req, res) {
  req.session.join = { email: req.body.email, username: req.body.username }

  const code = req.session.joinCode
  const comments = await request('https://scratch.mit.edu/site-api/comments/project/47606468/')
  const $ = cheerio.load(comments)
  let success = false

  let found = $(`[data-comment-user="${req.body.username}"] + div .content:contains(${code})`).length

  if(found) {
    if(req.body.password === req.body.passwordRepeat) {
      success = await db.user.join({
        email: req.body.email,
        username: req.body.username,
        password: req.body.password
      }) ? true : `Sorry, but <b>that user already exists</b>!`
    } else {
      success = `Those <b>passwords don't match</b>. Try retyping them?`
    }
  } else {
    success = `Looks like <b>we couldn't find a comment</b> with your code and username! Did you copy it correctly?`
  }

  if(success === true) {
    delete req.session.join
    delete req.session.joinCode

    let r = req.query.r || req.session.r || '/'
    delete req.session.r

    req.session.user = req.body.username

    res.redirect(r)
  } else {
    req.session.joinFailWhy = success
    res.redirect('/join')
  }
})

app.get('/signin', async function(req, res) {
  // if already signed in, skip
  if(req.session.user)
    res.redirect(req.query.r || '/')

  res.render('sign-in', {
    user: req.session.user,
    title: 'Sign In',

    code: req.session.joinCode,
    fail: req.session.signInFailWhy,
    already: req.session.signIn || {}
  })

  delete req.session.signInFailWhy
})

app.post('/signin', async function(req, res) {
  req.session.signIn = { username: req.body.username }

  let yay = await db.user.signIn(req.body.username, req.body.password)

  if(yay) {
    let r = req.query.r || req.session.r || '/'
    delete req.session.r

    req.session.user = req.body.username

    res.redirect(r)
  } else {
    req.session.signInFailWhy = `Sorry! That username and password doesn't match.`
    res.redirect('/signin')
  }
})

app.get('/signout', async function(req, res) {
  delete req.session.user

  res.redirect('/')
})

app.get('/you', mustSignIn, function(req, res) {
  res.redirect('/users/' + req.session.user)
})

app.get('/users/:who', async function(req, res) {
  let exists = await db.user.exists(req.params.who)

  if(!exists) {
    res.status(404).render('404', {
      user: req.session.user
    })

    return
  }

  let who = await db.user.get(req.params.who)

  if(who.username === req.session.user)
    who.isYou = true

  res.render('user', {
    user: req.session.user,
    who: who,
    whoJSON: JSON.stringify(who)
  })
})

app.get('/users/:who/avatar', async function(req, res) {
  let exists = await db.user.get(req.params.who)
  let size = req.query.s || 64

  if(!exists) {
    res.status(404).render('404', {
      user: req.session.user
    })

    return
  }

  const usr = await request(`https://api.scratch.mit.edu/users/${req.params.who}`, { json: true })
  const avatar = usr.profile.avatar.substr(0, usr.profile.avatar.length - 4).replace('/', '')

  res.redirect(`https://cdn2.scratch.mit.edu/get_image/user/${avatar}_${size}x${size}.png`)
})

app.get('/', function(req, res) {
  res.render('index', {
    user: req.session.user
  })
})

app.use(express.static('public'))

app.get('*', function(req, res) {
  res.status(404).render('404', {
    user: req.session.user
  })
})

/////////////////////////////////////////////////////////

app.listen(3000, function() {
  console.log('Listening on http://localhost:3000')
})