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
  console.error(err)
})

/////////////////////////////////////////////////////////

require('dotenv').config()

const path = require('path')
const fs = require('fs')

const express = require('express')
const multer = require('multer')
const bodyParser = require('body-parser')
const csrf = require('csurf')
const session = require('express-session')
const sessionStore = require('session-file-store')(session)
const exprhbs = require('express-handlebars')

const cheerio = require('cheerio')
const request = require('request-promise')

const marked = require('marked')
const base32 = require('base32')
const uniqid = require('uniqid').process
const shortid = require('shortid').generate
const rot = require('rot')
const bcrypt = require('bcrypt-as-promised')

const tada = '🎉'
const db = require('../db')

/////////////////////////////////////////////////////

const badWords = '\\o(shtyl|(\\j*?)shpx(\\j*?)|s(h|i|\\*)?p?x(vat?)?|(\\j*?)fu(v|1|y)g(\\j*?)|pe(n|@|\\*)c(cre|crq|l)?|(onq|qhzo|wnpx)?(n|@)ff(u(b|0)yr|jvcr)?|(onq|qhzo|wnpx)?(n|@)efr(u(b|0)yr|jvcr)?|onfgneq|o(v|1|y|\\*)?g?pu(r?f)?|phag|phz|(tbq?)?qnz(a|z)(vg)?|qbhpur(\\j*?)|(arj)?snt(tbg|tng)?|sevt(tra|tva|tvat)?|bzst|cvff(\\j*?)|cbea|encr|ergneq|frk|f r k|fung|fyhg|gvg|ju(b|0)er(\\j*?)|jg(s|su|u))(f|rq)?\\o' // rot13
const signupProjectId = 115307769 // null to disable check
const requireEmailConfirmedToShare = false

/////////////////////////////////////////////////////////

const badWordsRegex = new RegExp(rot(badWords, -13), 'gi')
const hasBadWords = text => text.match(badWordsRegex)
const replaceBadWords = (text, w='⋆⋆⋆⋆') => text.replace(badWordsRegex, w)

/////////////////////////////////////////////////////////

let app = express()

app.engine('hbs', exprhbs.create({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: 'public/views/layouts/',
  partialsDir: 'public/views/partials/',

  helpers: {
    md: raw => marked(raw, { sanitize: true }),
    json: raw => JSON.stringify(raw),
    timeago: raw => `<span class='timeago'>${raw}</span>`
  }
}).engine)

app.set('views', 'public/views')
app.set('view engine', 'hbs')

app.set('trust proxy', 1)
app.set('json spaces', 2)

app.use(session({
  secret: process.env.session_secret,
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
app.use(bodyParser.urlencoded({ extended: false }))

function mustSignIn(req, res, next) {
  if(req.session.user) {
    next()
  } else {
    req.session.r = req.originalUrl
    res.redirect('/signin')
  }
}

app.use(csrf({
  value: req => req.body.csrf
}))

app.use(function(err, req, res, next) {
  if(err.code !== 'EBADCSRFTOKEN') return next(err)

  res.status(403).render('403', {
    user: req.session.user
  })
})

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
    already: req.session.join || {},
    project: signupProjectId,
    csrfToken: req.csrfToken()
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

  function err(why) {
    req.session.joinFailWhy = why
    res.redirect('/join')
  }

  if(found) {
    if(req.body.password === req.body.passwordRepeat) {
      if((await db.User.find({ username: req.body.username })).length > 0) {
        console.log(await db.User.find({ name: req.body.username }))
        err('Sorry, but <b>that user already exists</b>!')
      } else {
        let user = new db.User({
          email: req.body.email,
          username: req.body.username,
          password: await bcrypt.hash(req.body.password, 12),
          joined: Date.now()
        })

        user.save(function(err) {
          if(err) {
            err('Looks like <b<something went wrong on our end</b>. Shoot us an email if this persists!')
          } else {
            delete req.session.join
            delete req.session.joinCode

            let r = req.query.r || req.session.r || '/'
            delete req.session.r

            req.session.user = req.body.username
            res.redirect(r)

            console.log(`${req.body.username} joined! ${tada}`)
          }
        })
      }
    } else {
      err(`Those <b>passwords don't match</b>. Try retyping them?`)
    }
  } else {
    err(`Looks like <b>we couldn't find a comment</b> with your code and username! Did you copy it correctly?`)
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
    already: req.session.signIn || {},
    csrfToken: req.csrfToken()
  })

  delete req.session.signInFailWhy
})

app.post('/signin', async function(req, res) {
  req.session.signIn = { username: req.body.username }

  let user = await db.User.find({ username: req.body.username })

  if(!user[0]) {
    req.session.signInFailWhy = `Sorry! That username and password doesn't match.`
    res.redirect('/signin')

    return
  }

  try {
    await bcrypt.compare(req.body.password, user[0].password)

    let r = req.query.r || req.session.r || '/'
    delete req.session.r

    req.session.user = req.body.username

    res.redirect(r)
  } catch(e) {
    req.session.signInFailWhy = `Sorry! That username and password doesn't match.`
    res.redirect('/signin')
  }
})

// allows for <img src='/signout'> which is *BAD*
// perhaps use PUT and check the Referrer header?
app.get('/signout', async function(req, res) {
  delete req.session.user

  res.redirect('/')
})

app.get('/you', mustSignIn, function(req, res) {
  res.redirect('/users/' + req.session.user)
})

app.get('/users/:who', async function(req, res) {
  let who = await db.User.find({
    username: req.params.who
  })

  if(who[0]) {
    who[0].exists = true
    who[0].isYou = who[0].username === req.session.user

    res.render('user', {
      user: req.session.user,
      who: who[0],
      csrfToken: req.csrfToken()
    })
  } else {
    try {
      let udata = await request(`https://api.scratch.mit.edu/users/${req.params.who}`, { json: true })

      who = {
        username: udata.username,
        exists: false
      }

      res.render('user', {
        user: req.session.user,
        who: who
      })
    } catch(e) {
      res.status(404).render('404', {
        user: req.session.user
      })
    }
  }
})

app.put('/users/:who/about', async function(req, res) {
  if(req.params.who !== req.session.user) {
    res.status(403).json(false)
  } else {
    let user = (await db.User.find({
      username: req.params.who
    }))[0]

    user.about = replaceBadWords(req.body.md)
    await user.save()

    res.status(200).json(user.about)
  }
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

  if(requireEmailConfirmedToShare && !req.session.udata.emailConfirmed) {
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
  if(!req.session.user) {
    req.session.r = req.originalUrl
    res.redirect('/signin')

    return
  }

  let u = db.user.get(req.session.user)

  res.json(req.files)
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

db.load().then(function() {
  app.listen(3000, function() {
    console.log('Listening on http://localhost:3000')
  })
})