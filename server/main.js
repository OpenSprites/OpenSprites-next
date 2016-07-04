/**
 * server/main.js
 * --------------
 * 
 * The server. Obviously.
 */
 console.log("=== OpenSwag Server ===")
 console.log("Loading libraries...")

require('dotenv').config()

const path = require('path')
const fs = require('fs')

const express = require('express')
const multer = require('multer')
const bodyParser = require('body-parser')
const csrf = require('csurf')
const session = require('express-session')
const compression = require('compression')
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

const hello = require('greetings')
const trianglify = require('trianglify')
const lwip = require('lwip')

const tada = '🎉'
const db = require('./db')

/////////////////////////////////////////////////////

const badWords = '\\o(shtyl|(\\j*?)shpx(\\j*?)|s(h|i|\\*)?p?x(vat?)?|(\\j*?)fu(v|1|y)g(\\j*?)|pe(n|@|\\*)c(cre|crq|l)?|(onq|qhzo|wnpx)?(n|@)ff(u(b|0)yr|jvcr)?|(onq|qhzo|wnpx)?(n|@)efr(u(b|0)yr|jvcr)?|onfgneq|o(v|1|y|\\*)?g?pu(r?f)?|phag|phz|(tbq?)?qnz(a|z)(vg)?|qbhpur(\\j*?)|(arj)?snt(tbg|tng)?|sevt(tra|tva|tvat)?|bzst|cvff(\\j*?)|cbea|encr|ergneq|frk|f r k|fung|fyhg|gvg|ju(b|0)er(\\j*?)|jg(s|su|u))(f|rq)?\\o' // rot13
const signupProjectId = process.env.project_id || null // '' to disable check
const requireEmailConfirmedToShare = false

console.log('Signup Project ID is #' + signupProjectId)

/////////////////////////////////////////////////////////

const badWordsRegex = new RegExp(rot(badWords, -13), 'gi')
const hasBadWords = text => text.match(badWordsRegex)
const replaceBadWords = (text, w='⋆⋆⋆⋆') => text.replace(badWordsRegex, w)

process.env.resources_name = process.env.resources_name || 'Stuff'

function squish(buffer, type) {
  return new Promise(function(done, reject) {
    // the best nodejs library ever written
    lwip.open(buffer, type, (err, imag) => {
      imag.contain(240, 240, function(err, imag) {
        if(err) {
          reject(err)
          return
        }

        imag.toBuffer('png', {
          compression: 'high'
        }, function(err, buff) {
          if(err) reject(err)
          else done(buff)
        })
      })
    })
  })
}

/////////////////////////////////////////////////////////

let app = express()

app.enable('trust proxy')

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
    Resources: () => process.env.resources_name[0].toUpperCase() + process.env.resources_name.substr(1),

    Hello: () => hello(),
    hello: () => hello().toLowerCase(),

    's?': val => val === 1? '' : 's'
  }
}).engine)

app.set('views', 'public/views')
app.set('view engine', 'hbs')

app.set('trust proxy', 1)
app.set('json spaces', 2)

app.use(compression())

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

function nocache(req, res, next) {
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
  res.header('Expires', '-1')
  res.header('Pragma', 'no-cache')
  next()
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
  let f = path.join(__dirname, '../', `public/assets/${req.params.type}/.dist/${req.params[0]}`)
  let f2 = path.join(__dirname, '../', `public/assets/${req.params.type}/${req.params[0]}`)

  fs.stat(f, function(err) {
    if(err) res.sendFile(f2)
    else res.sendFile(f)
  })
})

app.get('/join', nocache, async function(req, res) {
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
    project: signupProjectId != null,
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

app.get('/users/:who', nocache, async function(req, res) {
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
  if(!file){
    res.status(400).json({success: false, message: "Missing file"})
    return
  }
  let name = req.body.name
  let clientid = req.body.clientid
  let id = shortid()
  let where = path.join(__dirname, '../', 'db/uploads/', sanitize(id) + '.dat')

  let isAudio = file.mimetype.substr(0, 5) === 'audio'
  let svg
  let thumb
  if(process.env.db_file_storage == "true"){
    where = 'dbstorage/' + sanitize(id) + '.dat'
  }
  let isImage = file.mimetype.substr(0, 5) === 'image'

  if(isAudio) {
    svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="240" height="240">' +
      trianglify({
        width: 240,
        height: 240,
        seed: name
      }).svg().innerHTML
    + '</svg>'
  }

  if(isImage) {
    let type = file.mimetype.split("/")
    if(type.length < 2){
      res.status(400).json({success: false, message: "Unrecognized image type"})
      return
    } else {
      type = type[1]
    }
    thumb = await squish(file.buffer, type)
  }

  let resource = new db.Resource({
    _id: id,
    owners: [ req.session.user ],
    name: name,
    type: file.mimetype,
    fname: name,
    audio: isAudio,
    image: isImage,
    loading: false, // unused now
    when: Date.now(),
    cover: name,
    data: where,
    downloads: 0,
    thumbnail: svg || ''
  })

  let saveComplete = async function() {
    await resource.save()

    collection.resources.push(resource.id)
    await collection.save()

    if(process.env.db_file_storage == "true"){
      var writestream = db.GridFS.createWriteStream({
        filename: where + '.thumb'
      })
      writestream.write(file.buffer)
      writestream.end()
    } else {
      fs.writeFile(where + '.thumb', thumb, (err) => {
        if(err) throw err
      })
    }

    console.log(`${req.session.user} uploaded "${name}" ${tada}`)
    res.json({success: true, message: "File uploaded", clientid: clientid, osurl: '/' + process.env.resources_name.toLowerCase() + '/' + id})
  }
  
  if(process.env.db_file_storage == "true"){
    var writestream = db.GridFS.createWriteStream({
        filename: where
    })
    writestream.on('error', function(err){
      console.error('Error uploading file to db:', err)
      res.status(500).json({success: false, message: err})
    })
    writestream.on('finish', function(){
      saveComplete()
    })
    writestream.write(file.buffer)
    writestream.end()
  } else {
    fs.writeFile(where, file.buffer, function(err) {
      if(err) {
        console.error('Error uploading file:', err)
        res.status(500).json({success: false, message: err})
        return
      }
      
      saveComplete()
    })
  }
  
})

app.get('/collections/:id', nocache, async function(req, res) {
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

app.get(`/${process.env.resources_name.toLowerCase()}/:id`, nocache, async function(req, res) {
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

app.put(`/${process.env.resources_name.toLowerCase()}/:id/about`, async function(req, res) {
  let resource = await db.Resource.findOne({
    _id: req.params.id
  })

  if(!resource || !resource.owners.includes(req.session.user)) {
    res.status(403).json(false)
  } else {
    resource.about = replaceBadWords(req.body.md)
    await resource.save()

    res.status(200).json(resource.about)
  }
})

// 240 x 240px
app.get(`/${process.env.resources_name.toLowerCase()}/:id/raw`, async function(req, res) {
  const resource = await db
    .Resource.find({ _id: req.params.id }, { type: true, data: true, image: true })
  if(!resource[0]) {
    res.status(404).render('404', {
      user: req.session.user
    })
  } else {
    if(resource[0].image) {
      let location = resource[0].data + '.thumb'
      if(location.startsWith('dbstorage/')) {
        let readstream = db.GridFS.createReadStream({
          filename: location
        })
        res.contentType('image/png')
        readstream.pipe(res)
      } else {
        fs.readFile(location, (err, data) => {
          res.contentType('image/png')
            .send(data)
        })
      }
    } else {
      let location = resource[0].data
      if(location.startsWith('dbstorage/')) {
        let readstream = db.GridFS.createReadStream({
          filename: location
        })
        res.contentType(resource[0].type)
        readstream.pipe(res)
      } else {
        fs.readFile(location, (err, data) => {
          res.contentType(resource[0].type)
            .send(data)
        })
      }
    }
  }
})

app.get(`/${process.env.resources_name.toLowerCase()}/:id/download/:f?`, async function(req, res) {
  // I don't even code style mate
  const resource = await db
    .Resource.findOne({ _id: req.params.id }, { name: true, type: true, data: true, downloads: true, downloaders: true })
  if(!resource) {
    res.status(404).render('404', {
      user: req.session.user
    })
  } else if(!req.params.f) {
    let title = resource.name.replace(/\ /g, '-')
    let type = require('mime-types').extension(resource.type) || 'mp3'
    let f = `${sanitize(title)}.${type}`

    res.redirect(`/${process.env.resources_name.toLowerCase()}/${req.params.id}/download/${f}`)
  } else {
    if(!resource.downloaders.includes(req.ip)) {
      resource.downloads = (resource.downloads || 0) + 1
      resource.downloaders.push(req.ip)
      await resource.save()
    }

    let location = resource.data
    if(location.startsWith("dbstorage/")) {
      let readstream = db.GridFS.createReadStream({
        filename: location
      })
      res.contentType(resource.type)
          .set(`Content-Disposition`, `attachment; filename="${req.params.f}"`)
      readstream.pipe(res)
    } else {
      fs.readFile(resource.data, (err, data) => {
        res.contentType(resource.type)
          .set(`Content-Disposition`, `attachment; filename="${req.params.f}"`)
          .send(data)
      })
    }
  }
})

app.get(`/${process.env.resources_name.toLowerCase()}/:id/cover`, async function(req, res) {
  const resource = await db
    .Resource.findOne({ _id: req.params.id }, { image: true, audio: true, thumbnail: true, fname: true })

  if(resource.image)
    res.redirect(`/${process.env.resources_name.toLowerCase()}/${req.params.id}/raw`)
  else if(resource.audio) {
    res.contentType('image/svg+xml')
      .send(resource.thumbnail)
  }
})

app.get(`/${process.env.resources_name.toLowerCase()}/:id/cover-inb4`, async function(req, res) {
  let thumb = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="240" height="240">' +
    trianglify({
      width: 240,
      height: 240,
      seed: req.params.id
    }).svg().innerHTML
  + '</svg>'

  res.contentType('image/svg+xml').send(thumb)
})

app.get('/', nocache, async function(req, res) {
  let recent = db.Resource.find({}, {
    data: false
  }).sort({ when: -1 }).limit(5)

  let downloaded = db.Resource.find({}, {
    data: false
  }).sort({ downloaded: 1, when: -1 }).limit(5)

  res.render('index', {
    user: req.session.user,
    recentResources: await recent,
    downloadedResources: await downloaded
  })
})

/////////////////////////////////////////////////////////

app.get('/dmca', function(req, res) {
  let f = path.join(__dirname, '../', 'DMCA.md')

  fs.readFile(f, 'utf8', function(err, file) {
    res.render('md-page', {
      user: req.session.user,
      title: 'DMCA',
      markdown: file || 'Not found!'
    })
  })
})

app.get('/tos', function(req, res) {
  let f = path.join(__dirname, '../', 'ToS.md')

  fs.readFile(f, 'utf8', function(err, file) {
    res.render('md-page', {
      user: req.session.user,
      title: 'Terms of Service',
      markdown: file || 'Not found!'
    })
  })
})

app.get('/privacy', function(req, res) {
  let f = path.join(__dirname, '../', 'PRIVACY.md')

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
  var port = process.env.server_port || 3000;
  app.listen(port, function() {
    console.log('Listening on http://localhost:' + port + ' ' + tada)
  })
})