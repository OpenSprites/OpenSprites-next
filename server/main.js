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
  console.log('Error in Promise:', err)
})

/////////////////////////////////////////////////////////

const path = require('path')
const fs = require('fs')

const express = require('express')
const multer = require('multer')
const bodyParser = require('body-parser')
const session = require('express-session')
const sessionStore = require('session-file-store')(session)
const exprhbs = require('express-handlebars')

const cheerio = require('cheerio')
const request = require('request-promise')

const marked = require('marked')
const base32 = require('base32')
const uniqid = require('uniqid').process
const shortid = require('shortid').generate

const db = require('../db')

/////////////////////////////////////////////////////

const signupProjectId = 115307769 // null to disable check
const requireEmailConfirmedToShare = false

/////////////////////////////////////////////////////////

let app = express()

app.engine('hbs', exprhbs.create({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: 'public/views/layouts/',
  partialsDir: 'public/views/partials/',

  helpers: {
    md: markdown => marked(markdown)
  }
}).engine)

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

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../', 'db/resource')),
    filename: (req, file, cb) => {
      if(!req.session.user) cb(null, false)

      let filename = base32.encode(
        shortid()
      )

      cb(null, filename)
    }
  })
})

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

function mustSignIn(req, res, next) {
  if(req.session.user) {
    next()
  } else {
    req.session.r = req.originalUrl
    res.redirect('/signin')
  }
}

/////////////////////////////////////////////////////////

app.get('/assets/:type/*', function(req, res) {
  let f = path.join(__dirname, '../../', `public/assets/${req.params.type}/.dist/${req.params[0]}`)
  let f2 = path.join(__dirname, '../../', `public/assets/${req.params.type}/${req.params[0]}`)

  fs.stat(f, function(err) {
    if(err) res.sendFile(f2)
    else res.sendFile(f)
  })
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
  let found = true

  if(signupProjectId) {
    const comments = await request(`https://scratch.mit.edu/site-api/comments/project/${signupProjectId}/`)
    const $ = cheerio.load(comments)

    found = $(`[data-comment-user="${req.body.username}"] + div .content:contains(${code})`).length
  }

  let success = false

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

// todo: change to POST and modify nav to reflect that
// atm allows for <img src='/signout'> which is *BAD*
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
    try {
      await request(`https://api.scratch.mit.edu/users/${req.params.who}`, { json: true })
      let who = {
        username: req.params.who,
        exists: false
      }

      res.render('user', {
        user: req.session.user,
        who: who,
        whoJSON: JSON.stringify(who)
      })
    } catch(e) {
      res.status(404).render('404', {
        user: req.session.user
      })
    }

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
  let size = req.query.s || 64

  try {
    const usr = await request(`https://api.scratch.mit.edu/users/${req.params.who}`, { json: true })

    const avatar = usr.profile.avatar.substr(0, usr.profile.avatar.length - 4).replace('/', '')

    res.redirect(`https://cdn2.scratch.mit.edu/get_image/user/${avatar}_${size}x${size}.png`)
  } catch(e) {
    res.status(404).render('404', {
      user: req.session.user
    })
  }
})

app.get('/share', async function(req, res) {
  if(!req.session.user) {
    req.session.r = req.originalUrl
    res.redirect('/signin')

    return
  }

  let u = await db.users.get(req.session.user)

  if(requireEmailConfirmedToShare && !u.emailConfirmed) {
    res.render('md-page', {
      user: req.session.user,
      title: 'Share',
      markdown: `
# Share
We need you to [verify your email address](/verify) before you can share resources with others. Sorry about that!
      `
    })

    return
  }

  res.render('share', {
    user: req.session.user,
    title: 'Share'
  })
})

app.post('/share', upload.any(), async function(req, res) {

  //!!! WARNING - UNTESTED CODE !!!\\
  // |     THIS CODE HAS NOT     | \\
  // |       TESTED YET!!!       | \\
  // |                           | \\
  // |   IT MAY CAUSE SERIOUS    | \\
  // |      ISSUES SUCH AS:      | \\
  // |                           | \\
  // |  * SYNTAX ERRORS          | \\
  // |  * DELETION OF HARD DRIVE | \\
  // |  * DATABASE CORRUPTION    | \\
  // |                           | \\
  // | CONTINUE AT YOUR OWN RISK | \\
  // +                           + \\

  res.set('Content-Type', 'text/plain')
  res.end('not implemented')

  return 0

  // <<   END OF UNTESTED CODE  >> \\

  if(!req.session.user) {
    req.session.r = req.originalUrl
    res.redirect('/signin')

    return
  }

  let u = await db.users.get(req.session.user)

  res.set('Content-Type', 'image/png')
  res.end('Okay')
})

app.get('/', function(req, res) {
  res.render('index', {
    user: req.session.user
  })
})

/////////////////////////////////////////////////////////

app.get('/dmca', function(req, res) {
  let f = path.join(__dirname, '../../', 'DMCA.md')

  fs.readFile(f, 'utf8', function(err, file) {
    res.render('md-page', {
      user: req.session.user,
      title: 'DMCA',
      markdown: file || 'Not found!'
    })
  })
})

app.get('/tos', function(req, res) {
  let f = path.join(__dirname, '../../', 'ToS.md')

  fs.readFile(f, 'utf8', function(err, file) {
    res.render('md-page', {
      user: req.session.user,
      title: 'Terms of Service',
      markdown: file || 'Not found!'
    })
  })
})

app.get('/privacy', function(req, res) {
  let f = path.join(__dirname, '../../', 'PRIVACY.md')

  fs.readFile(f, 'utf8', function(err, file) {
    res.render('md-page', {
      user: req.session.user,
      title: 'Privacy Policy',
      markdown: file || 'Not found!'
    })
  })
})

/////////////////////////////////////////////////////////

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