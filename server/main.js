/**
 * server/main.js
 * --------------
 * 
 * The server. Obviously.
 */
 console.log('=== OpenSwag Server ===')
 console.log('Loading dependencies...')

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
const bcrypt = require('bcrypt-as-promised')

const hello = require('greetings')
const trianglify = require('trianglify')
const lwip = require('lwip')

const piexif = require('piexifjs')

const tada = '🎉'
const db = require('./db')

const replaceBadWords = require('./utils/replace-bad-words')
const callbackToPromise = require('./utils/callback-to-promise')

/////////////////////////////////////////////////////////

// yay, our second legit model
const Resource = require('./models/Resource')
const Collection = require('./models/Collection')

/////////////////////////////////////////////////////////

const signupProjectId = process.env.project_id || null
const requireEmailConfirmedToShare = false

/////////////////////////////////////////////////////////

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

    resources: () => "resources",
    Resources: () => "Resources",

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

// log the ip of the logged in user
app.use(async function logIP(req, res, next) {
  if(req.session.user) {

    let user = await db.User.findOne({
      username: req.session.user,
      ip: {
        // where User.ip does not contain req.ip
        $nin: [ req.ip ]
      }
    }, 'ip')

    if(user) {
      user.ip.push(req.ip)

      await user.save()
    }
  }

  next()
})

// set the logged in user's online status
app.use(async function onlineStatus(req, res, next) {
  if(req.session.user) {

    let user = await db.User.findOne({
      username: req.session.user
    }, 'online')

    if(user) {
      user.online = Date.now()

      await user.save()
    }
  }

  next()
})

// error handlers //

app.use(function(err, req, res, next) {
  if(err.code !== 'EBADCSRFTOKEN') return next(err)

  console.log(req.session.user, 'hit CSRF error')

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

    console.log(`${req.session.user} signed in`)
    res.redirect(r)
  } catch(e) {
    req.session.signInFailWhy = `Sorry! That username and password doesn't match.`
    res.redirect('/signin')
  }
})

// allows for <img src='/signout'> which is *BAD*
// perhaps use PUT and check the Referrer header?
app.get('/signout', async function(req, res) {
  console.log(`${req.session.user} signed out`)

  delete req.session.user
  res.redirect(req.originalUrl || '/')
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

    let about = replaceBadWords(req.body.md)
    if(about.length > 1024){
      about = about.substring(0, 1024)
    }
    user.about = about
    await user.save()

    res.status(200).json({about: user.about})
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
  
  try {
     let collection = await db.Collection.find({
      owners: req.session.user,
      isShared: true
    })
  
    if(collection[0]) {
      collection = collection[0]
    } else {
      collection = new db.Collection({
        _id: shortid(),
        name: 'Shared',
        owners: [req.session.user],
        isShared: true
      })
    }
  
    let file = req.file
    if(!file){
      res.status(400).json({success: false, message: "Missing file"})
      return
    }

    if(file.mimetype == "image/jpeg") {
        // Remove EXIF data
        console.log("User is uploading a JPEG, blanking EXIF data") 
        console.log(file.buffer)      
        let imageOld = "data:image/jpeg;base64," + file.buffer.toString("base64")
        let imageNew = piexif.remove(imageOld).substring(imageOld.indexOf(','))
        let newBuffer = new Buffer(imageNew, 'base64')
        console.log(newBuffer)
        file.buffer.write(newBuffer)
        console.log(file.buffer)      
    }

    let name = req.body.name
    let clientid = req.body.clientid
    let id = shortid()
    let where = path.join(__dirname, '../', 'db/uploads/', sanitize(id) + '.dat')
  
    let isAudio = file.mimetype.substr(0, 5) === 'audio'
    let thumb
    if(process.env.db_file_storage == "true"){
      where = 'dbstorage/' + sanitize(id) + '.dat'
    }
    let isImage = file.mimetype.substr(0, 5) === 'image'
  
    if(isAudio) {
      let pngURI = trianglify({
        width: 240,
        height: 240,
        seed: name
      }).png()
      let data = pngURI.substr(pngURI.indexOf('base64') + 7);
      thumb = new Buffer(data, 'base64');
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
  
    let resource = Resource.create({
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
      thumbnail: where + '.thumb'
    })
    
    await resource.uploadThumbnail(thumb)
    
    await resource.uploadContent(file.buffer)
  
    await resource.save()
  
    collection.resources.push(resource._id)
    await collection.save()
  
    console.log(`${req.session.user} uploaded "${name}" ${tada}`)
    res.json({success: true, message: "File uploaded", clientid: clientid, osurl: '/resources/' + id})    
  } catch(err){
    console.log(err)
    res.status(500).json({success: false, message: err})
  }
})

app.get('/collections/:id', nocache, async function(req, res) {
  try {
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
      
      collection[0].youOwn = collection[0].owners.includes(req.session.user || '')
  
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
  } catch(err){
    console.log(err)
    res.status(500).render('500', {
      user: req.session.user
    })
  }
})

app.get('/collections/:id/cover', nocache, async function(req, res) {
  try {
    let collection = await db.Collection.find({
      _id: req.params.id
    })
  
    if(!collection[0]) throw "Collection not found: " + req.params.id;
    let rs = []
    for(let i = 0; i < collection[0].resources.length; i++) {
      let res = collection[0].resources[i]
      if(!res) continue
      let r = await Resource.findById(res)
      if(r) rs.push(r)
    }
    rs.reverse()
    rs = rs.filter(e => !e.deleted)
  
    let $ = callbackToPromise
  
    let image = await $(lwip, lwip.create, 240, 240, {r:0, g:0, b:0, a:0})
    
    for(var i = 0; i < Math.min(rs.length, 4); i++) {
      let thumbData = await rs[i].getThumbnail()
      let thumb = await $(lwip, lwip.open, thumbData.data, 'png')
      thumb = await $(thumb, thumb.cover, 120, 120, "lanczos")
      let x = (i % 2 == 0) ? 0 : 120
      let y = (i < 2) ? 0 : 120
      image = await $(image, image.paste, x, y, thumb)
    }
    
    let buf = await $(image, image.toBuffer, 'png')
    
    res.contentType('image/png').send(buf)
  } catch(err) {
    if(err.message !== 'Invalid source') console.log(err)

    res.redirect('/assets/img/logo/icon.png')
  }
})

app.put('/collections/:id/about', nocache, async function(req, res) {
  try {
    let collection = await Collection.findById(req.params.id)
    
    if(!collection.owners.includes(req.session.user)) {
      res.status(403).json(false)
    }
    
    if(req.body.md) {
      collection.updateAbout(req.body.md)
    }
    
    if(req.body.title) {
      collection.updateTitle(req.body.title)
    }
    
    await collection.save()
    
    res.status(200).json({about: collection.about, title: collection.name})
  } catch(err){
    console.log(err)
    res.status(404).json(false)
  }
})

app.get(`/resources/:id`, nocache, async function(req, res) {
  let resource = await db.Resource.find({
    _id: req.params.id
  }, {
    data: false
  })

  let user = {}

  if(req.session.user) {
    user = await db.User.findOne({
      username: req.session.user
    })
  }

  if(resource[0]) {
    if(resource[0].deleted && !user.admin) {
      res.status(403).render('404', {
        user: req.session.user
      })

      return
    }

    resource[0].comments.reverse()

    res.render('resource', {
      user: req.session.user,
      u: user,
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

// for DRY's sake
async function delResource(DEL, req, res) {
  let resource = await db.Resource.findOne({
    _id: req.params.id
  }, {
    owners: true
  })

  let user = await db.User.findOne({
    username: req.session.user
  })

  if(resource) {
    if(user.admin || resource.owners.includes(user.username)) {
      resource.deleted = DEL
      await resource.save()

      res.json('success')
    } else {
      res.status(403).render('403', {
        user: req.session.user
      })
    }
  } else {
    res.status(404).render('404', {
      user: req.session.user
    })
  }
}

app.delete(`/resources/:id`, mustSignIn, async function(req, res) {
  await delResource(true, req, res)
})

app.post(`/resources/:id`, mustSignIn, async function(req, res) {
  await delResource(false, req, res)
})

app.put(`/resources/:id/about`, async function(req, res) {
  let resource
  try {
    resource = await Resource.findById(req.params.id)
  } catch(err) {
    console.log(err)
    res.status(404).json(false)
  }

  if(!resource.owners.includes(req.session.user)) {
    res.status(403).json(false)
  } else {
    if(req.body.md) {
      resource.updateAbout(req.body.md)
    }
    if(req.body.title) {
      resource.updateTitle(req.body.title)
    }
    try {
      await resource.save()
      res.status(200).json({about: resource.about, title: resource.name})
    } catch(err) {
      console.log(err)
      res.status(500).json(false)
    }
  }
})

// 240 x 240px
app.get(`/resources/:id/raw`, async function(req, res) {
  let resource
  
  try {
    resource = await Resource.findById(req.params.id)
  } catch(err){
    console.log(err)
    res.status(404).render('404', {
      user: req.session.user
    })
    return
  }

  if(resource.image){
    try {
      let thumb;
      if(resource.type == "image/gif") {
        res.contentType("image/gif")
        resource.downloadToResponse(req, res)
      } else {
        thumb = await resource.getThumbnail()
        res.contentType(thumb.contentType)
        res.send(thumb.data)
      }
    } catch(err){
      console.log(err)
      res.status(404).render('404', {
        user: req.session.user
      })
    }
  } else {
    resource.downloadToResponse(req, res)
  }
})

app.get(`/resources/:id/download/:f?`, async function(req, res) {
  let resource
  try {
    resource = await Resource.findById(req.params.id)
  } catch(err){
    console.log(err)
    res.status(404).render('404', {
      user: req.session.user
    })
    return
  }
  
  if(!req.params.f) {
    let title = resource.name.replace(/\ /g, '-')
    let type = require('mime-types').extension(resource.type) || 'mp3'
    let f = `${sanitize(title)}.${type}`

    res.redirect(`/resources/${req.params.id}/download/${f}`)
  } else {
    try {
      await resource.incrementDownloads(req.ip)
    } catch(err){
      console.log(err)
      // continue to download anyway
    }
    res.set("Content-Disposition", "attachment; filename=\"" + req.params.f + "\"")
    resource.downloadToResponse(req, res)
  }
})

// DEPRECATED
app.get(`/resources/:id/cover`, async function(req, res) {
 try {
    let resource = await Resource.findById(req.params.id)
    if(resource.audio) {
      let thumb = await resource.getThumbnail()
      res.contentType(thumb.contentType)
      res.send(thumb.data)
    } else {
      res.redirect(`/resources/${req.params.id}/raw`)
    }
  } catch(err){
    console.log(err)
    res.status(404).render('404', {
      user: req.session.user
    })
  }
})

app.get(`/resources/:id/cover-inb4`, async function(req, res) {
  let thumb = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="240" height="240">' +
    trianglify({
      width: 240,
      height: 240,
      seed: req.params.id
    }).svg().innerHTML
  + '</svg>'

  res.contentType('image/svg+xml').send(thumb)
})

app.get('/admin', nocache, async function(req, res) {
  const user = await db.User.findOne({
    username: req.session.user
  })

  if(!user || !user.admin) {
    res.render('403', { user: req.session.user })
    return
  }

  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 25

  const resources = db.Resource.find()
    .sort({ when: -1 })
    .skip((page - 1) * limit)
    .limit(limit)

  res.render('admin', {
    user: req.session.user,
    resources: await resources,

    page, limit,
    lastPage: page - 1,
    nextPage: page + 1,

    csrf: req.csrfToken()
  })
})

app.post('/comment', mustSignIn, async function(req, res) {
  let where = {}

  if(req.body.pageType === 'resource') {
    where = await db.Resource.findOne({
      _id: req.body.id
    })
  }

  if(where) {
    // todo: use subset of markdown on `what`
    let what = req.body.what.substr(0, 500)

    // handlebars automatically uses safe html
    // so we don't have to worry about that

    where.comments.push({
      who: req.session.user,
      what
    })

    await where.save()
    res.json('success')
  } else {
    res.status(404).render('404', { user: req.session.user })
  }
})

app.get('/', nocache, async function(req, res) {
  let recent = db.Resource.find({
    deleted: false
  }, {
    data: false
  }).sort('-when').limit(10)

  let downloaded = db.Resource.find({
    deleted: false
  }, {
    data: false
  }).sort('-downloads -when').limit(10)

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
  const port = process.env.server_port || 3000

  app.listen(port, function() {
    console.log('Listening on http://localhost:' + port + ' ' + tada)
  })
})
