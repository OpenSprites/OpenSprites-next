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
const sanitize = require('sanitize-filename')
const shortid = require('shortid').generate
const uniqid = require('uniqid').process
const rot = require('rot')
const bcrypt = require('bcrypt-as-promised')

const trianglify = require('trianglify')

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

process.env.resources_name = process.env.resources_name || 'Stuff'

/////////////////////////////////////////////////////////

let app = express()

app.engine('hbs', exprhbs.create({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: 'public/views/layouts/',
  partialsDir: 'public/views/partials/',

  helpers: {
    md: raw => marked(raw || '', { sanitize: true }),
    json: raw => JSON.stringify(raw),
    timeago: raw => `<span class='timeago'>${raw}</span>`,
    by: owners => {
      let res = ''
      owners.forEach((owner, i) => {
        let add = ', '
        if(owners.length-1 === i) add = ' and '
        if(i === 0) add = 'by '

        res += `${add}<a href='/users/${owner}'>${owner}</a>`
      })
      return res
    },
    lower: upper => upper.toLowerCase(),
    resources: () => process.env.resources_name.toLowerCase(),
    Resources: () => process.env.resources_name[0].toUpperCase() + process.env.resources_name.substr(1)
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

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const upload = multer({
  storage: multer.memoryStorage({
    limits: {
      fileSize: 52428800 // ~50mb.
    }
  })
})

function mustSignIn(req, res, next) {
  if(req.session.user) {
    next()
  } else {
    req.session.r = req.originalUrl
    res.redirect('/signin')
  }
}

app.use(csrf({
  value: req => {
    return req.body.csrf || req.headers['x-csrf-token']
  }
}))

app.use(function(err, req, res, next) {
  if(err.code !== 'EBADCSRFTOKEN') return next(err)

  res.status(403).render('403', {
    user: req.session.user
  })
})

app.use(function(err, req, res, next) {
  res.status(500).render('500', {
    user: req.session.user,
    err
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

    user[0].online = true
    user[0].save()

    res.redirect(r)
  } catch(e) {
    req.session.signInFailWhy = `Sorry! That username and password doesn't match.`
    res.redirect('/signin')
  }
})

// allows for <img src='/signout'> which is *BAD*
// perhaps use PUT and check the Referrer header?
app.get('/signout', async function(req, res) {
  let user = await db.User.findOne({ username: req.session.user })
  user.online = false
  user.save()

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

    let collections = await db.Collection.find({
      owners: who[0].username
    })

    res.render('user', {
      user: req.session.user,
      collections,
      who: who[0],
      csrfToken: req.csrfToken(),
      title: who.username
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
        who: who,
        title: who.username
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

  req.session.csrf = req.csrfToken() // bit hacky
  res.render('share', {
    user: req.session.user,
    title: 'Share',
    csrfToken: req.csrfToken()
  })
})

app.put('/share', upload.single('file'), async function(req, res) {
  if(!req.session.user) {
    req.session.r = req.originalUrl
    res.redirect('/signin')

    return
  }

  let collection = await db.Collection.find({
    owners: req.session.user,
    isShared: true
  })

  if(collection[0]) {
    collection = collection[0]
  } else {
    collection = new db.Collection({
      _id: shortid(),
      name: 'Shared Resources',
      owners: [req.session.user],
      isShared: true
    })
  }

  let file = req.file
  let name = req.body.name
  let id = shortid()
  let where = path.join(__dirname, '../../', 'db/uploads/', sanitize(id) + '.dat')

  let resource = new db.Resource({
    _id: id,
    owners: [ req.session.user ],
    name: name,
    type: file.mimetype,
    audio: file.mimetype.substr(0, 5) === 'audio',
    image: file.mimetype.substr(0, 5) === 'image',
    loading: false, // unused now
    when: Date.now(),
    cover: name,
    data: where
  })

  fs.writeFile(where, file.buffer, async function(err) {
    if(err) {
      console.error('Error uploading file:', err)
      res.status(500).render('500', {  user: req.session.user, err })
      return
    }

    await resource.save()

    collection.resources.push(resource.id)
    await collection.save()

    console.log(`${req.session.user} uploaded "${name}" ${tada}`)
    res.json(tada)
  })
  
})

app.get('/collections/:id', async function(req, res) {
  let collection = await db.Collection.find({
    _id: req.params.id
  })

  if(collection[0]) {
    let rs = []

    for(let i = 0; i < collection[0].resources.length; i++) {
      let r = await db.Resource.findOne({ _id: collection[0].resources[i] }, 'name owners audio image')
      if(r) rs.push(r)
    }

    rs.reverse() // order by "latest added to collection"

    res.render('collection', {
      user: req.session.user,
      collection: collection[0],
      resources: rs,
      csrfToken: req.csrfToken()
    })
  } else {
    res.status(404).render('404', {
      user: req.session.user
    })
  }
})

app.get(`/${process.env.resources_name.toLowerCase()}/:id`, async function(req, res) {
  let resource = await db.Resource.find({
    _id: req.params.id
  }, {
    data: false
  })

  if(resource[0]) {
    res.render('resource', {
      user: req.session.user,
      resource: resource[0],
      csrfToken: req.csrfToken(),
      title: resource[0].name,
      youOwn: resource[0].owners.includes(req.session.user||''),
      head: `<!-- Social: Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:creator" content=${JSON.stringify(resource[0].owners[0])}>
<meta name="twitter:title" content=${JSON.stringify(resource[0].name)}>
<meta name="twitter:description" content=${JSON.stringify(resource[0].about)}>
<meta name="twitter:image:src" content="${req.originalUrl}/raw">

<!-- Social: Facebook / Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content=${JSON.stringify(resource[0].name)}>
<meta property="og:image" content="${req.originalUrl}/raw">
<meta property="og:description" content=${JSON.stringify(resource[0].about)}>
<meta property="og:site_name" content="OpenSprites">


<!-- Social: Google+ / Schema.org  -->
<meta itemprop="name" content=${JSON.stringify(resource[0].name)}>
<meta itemprop="description" content=${JSON.stringify(resource[0].about)}>
<meta itemprop="image" content="${req.originalUrl}/raw">`
    })
  } else {
    res.status(404).render('404', {
      user: req.session.user
    })
  }
})

app.get(`/${process.env.resources_name.toLowerCase()}/:id/raw`, async function(req, res) {
  let resource = await db.Resource.find({
    _id: req.params.id
  }, {
    type: true,
    data: true
  })

  if(resource[0]) {
    fs.readFile(resource[0].data, (err, data) => res.contentType(resource[0].type).send(data))
  } else {
    res.status(404).render('404', {
      user: req.session.user
    })
  }
})

app.get(`/${process.env.resources_name.toLowerCase()}/:id/cover`, async function(req, res) {
  let resource = await db.Resource.findOne({
    _id: req.params.id
  }, {
    cover: true
  })

  if(!resource) {
    res.status(404).render('404', {
      user: req.session.user
    })

    return
  }

  res.redirect(`/${process.env.resources_name.toLowerCase()}/${resource.cover}/cover-inb4`)
})

app.get(`/${process.env.resources_name.toLowerCase()}/:id/cover-inb4`, async function(req, res) {
  let art = trianglify({
    width: 240,
    height: 240,
    seed: req.params.id
  }).svg().innerHTML

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="240" height="240">'

  res.contentType('image/svg+xml').send(svg + art + '</svg>')
})

app.get('/', async function(req, res) {
  let recent = db.Resource.find({}, {
    data: false
  }).sort({ when: -1 }).limit(5)

  res.render('index', {
    user: req.session.user,
    recentResources: await recent
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
    console.log('Listening on http://localhost:3000 ' + tada)
  })
})