const console = require('loggy') // yeah, yeah
console.notificationsTitle = 'OpenSprites Server'

console.info('=== OpenSprites Server ===')
console.info('Loading dependencies...')

let startLoad = Date.now()
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
const markedRenderer = new marked.Renderer()

// exit with proper code
process.on('exit', () => process.exit(console.errorHappened ? 1 : 0))

// make header links like github
// eg /about#team
markedRenderer.heading = function (text, level) {
  var escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');

  return '<h' + level + '><a name="' +
                escapedText +
                 '" class="anchor" href="#' +
                 escapedText +
                 '"><span class="header-link"></span></a>' +
                  text + '</h' + level + '>';
}

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
const Resource = require('./models/Resource')
db.Resource = Resource
const Collection = require('./models/Collection')
db.Collection = Collection
const User = require('./models/User')
db.User = User

const replaceBadWords = require('./utils/replace-bad-words')
const callbackToPromise = require('./utils/callback-to-promise')
const scratchBuilder = require('./utils/scratch-builder')
scratchBuilder.init()
const cubeupload = require('./utils/cubeupload')
const minify = require('./utils/minify')
const email = require('./utils/email')
const search = require('./utils/search')

/////////////////////////////////////////////////////////

console.info("Loading server...")

/////////////////////////////////////////////////////////

const signupProjectId = process.env.project_id || null
const requireEmailConfirmedToShare = false

/////////////////////////////////////////////////////////

function squish(buffer, type) {
  return new Promise(function(done, reject) {
    // the best nodejs library ever written
    lwip.open(buffer, type, (err, imag) => {
      if(err){
        reject(err)
        return
      }

      function complete(err, imag) {
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
      }


      if(imag.width() >= 240 || imag.height >= 240) imag.contain(240, 240, complete)
      else {
        lwip.create(240, 240, {r:0, g:0, b:0, a:0}, function(err, image){
          if(err){
            reject(err)
            return
          }
          image.paste((240 - imag.width())/2, (240 - imag.height())/2, imag, complete)
        })
      }
    })
  })
}

function squishSVG(svg) {
  const SVGO = require('svgo')
  const svgo = new SVGO()

  // convert buffer to string
  svg = svg.toString('utf8')

  return new Promise(function(done) {
    svgo.optimize(svg, function(res) {
      done(new Buffer(res.data))
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
    md: raw => marked(raw || '', { sanitize: true, renderer: markedRenderer }),
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
    byRaw: owners => {
      let res = ''
      owners.forEach((owner, i) => {
        let add = ', '
        if(owners.length-1 === i) add = ' and '
        if(i === 0) add = 'by '

        res += add + owner
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
  maxAge: 1000 * 3600 * 24 * 30,
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

  console.warn(req.session.user, 'hit CSRF error')

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
  if(req.get('accept').indexOf('text/html') < 0) {
    res.end(new Buffer('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wgARCAClAOcDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABYBAQEBAAAAAAAAAAAAAAAAAAABAv/aAAwDAQACEAMQAAABIAAAAAAAAAAAAAACkAKQAAAFBAAAAAAAmlhAUhSApACoUAAQAAAAqFgKQpEqiAFBAAAAAAAUAhSFAIACoUAQAAAAApCgEKCAAFBAAAAAAAUgKCAoABCggBSAAAAAAAAAoAIUAIUQAAAAAAAAAAAoBAAAAAAAAAAAAAAUgBQQAAAFAAAAIUgAKCFBAAAACgAAAgSqBACgEAAAAABSAAAFIUgAShYAAAAACkAAAKQpAAUEAAAAABSAAAJQogAKQAAAAAApAAAEqgAQFIAAAAAAUgAABSAoICkAAAAAAKQAAAAAAFIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//8QAFBABAAAAAAAAAAAAAAAAAAAAkP/aAAgBAQABBQIYf//EAB0RAAEFAAMBAAAAAAAAAAAAABEAATBAQRBQYHD/2gAIAQMBAT8B797r3XjCFF/ChDxAQQQQQQsZCU9PIM4enkGcPTzpj8i//8QAFBEBAAAAAAAAAAAAAAAAAAAAkP/aAAgBAgEBPwEYf//EABQQAQAAAAAAAAAAAAAAAAAAAJD/2gAIAQEABj8CGH//xAAUEAEAAAAAAAAAAAAAAAAAAACQ/9oACAEBAAE/IRh//9oADAMBAAIAAwAAABAkkkkkkkkkkkkkkkkkkkkkgEkkkkkkoEkgkkkMkkEkkkkskklgkgEkkkkkkkEkkgkkskEkkkkkkkkkkkgEkkkkkkgkgkEAEAkgkkkkkkkkkAAgksEkkkkkkkkkkkAEkkkkkkkkkkkkkgkkEkkkgkkkggkkggkkkkkAgAAlkkkkkkkkkkkkkkkkklskkkkkkkkkkkkkkEkkkkkkkkktgkkkkkkkkkkkklkkEkkkkkkkkkkkkkAkkkkkkkkEkkkkkkgkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk//8QAJBEAAQMEAgICAwAAAAAAAAAAAQARMRAgMEEhUUBxgcFQYGH/2gAIAQMBAT8Q84jgWEcDydNcarGwSESOk46TjpOOk46RbrEYCkf0VlQb9Uj2nsEhGTnMBAsiNikqDfpDu4SiKhDZDAoC3pEKVAZWjcJCMnO/DVB0UZqCybpMUx6qJCMnyHKc1EhEF06hwIRL+S57/BAbKPOEB05OTk5OTk6rbtHIZM1ByUTrxALBOUrAdFEMhwCcv2xJWiEesv2xJW6PjByFHu7RzCDg18pycdJurBBzDeDXzYS9RvMC2cFn/Yv/xAAfEQABAwQDAQAAAAAAAAAAAAAAARFBECAwQDFQYCH/2gAIAQIBAT8Q79LX1eKpRac7KUW9Rxx9FKzvv0bj+IccccccfYnBIwmnOCaJaomWcE0S2c04JObp1pGPo+kuCb19/wD/xAAUEAEAAAAAAAAAAAAAAAAAAACQ/9oACAEBAAE/EBh//9k=', 'base64'))
    return 
  }
  console.log(`${req.session.user} signed out`)

  delete req.session.user
  res.redirect('/')
})

app.get('/you', mustSignIn, function(req, res) {
  res.redirect('/users/' + req.session.user)
})

app.get('/search', nocache, async function(req, res){
  res.render('search', {
    csrfToken: req.csrfToken(),
    user: req.session.user,
  })
})

app.post('/search', nocache, async function(req, res) {
  if(!req.body.q || !req.body.category || ['Resource', 'User', 'Collection'].indexOf(req.body.category) < 0) {
    res.end('Invalid parameters')
  } else {
    let results = await search(db[req.body.category], req.body.q, req.body.sort || 'relevance')
    results.isCollection = req.body.category == 'Collection'
    results.isResource = req.body.category == 'Resource'
    results.isUser = req.body.category == 'User'
    res.render('partials/search_results', {
      layout: false,
      results
    })
  }
})

app.get('/you/collections', nocache, mustSignIn, async function(req, res){
  try {
    let who = await db.User.findOne({
      username: req.session.user
    })
    if(!who) throw "User not found"

    let ownedCollections = await db.Collection.find(
      {owners: who.username, isShared: false},
      {_id: 1, name: 1})
    let curatedCollections = await db.Collection.find(
      {curators: who.username, 'permissions.curators.addItems': true, isShared: false},
      {_id: 1, name: 1})

    let all = ownedCollections.slice().concat(curatedCollections.slice())
    let allHash = {}
    for(let item of all){
      allHash[item._id.toString()] = { name: item.name, _id: item._id, has: false}
    }

    let what = req.query.what

    if(what) {
      let collectionsWithItem = await db.Collection.find(
        {isShared: false, 'items.item': what},
        {_id: 1, name: 1}
      )

      for(let item of collectionsWithItem) {
        if(allHash[item._id.toString()]) {
          allHash[item._id.toString()].has = true
        } else {
          allHash[item._id.toString()] = { name: item.name, _id: item._id, has: true}
        }
      }
      res.status(200).json(allHash)
    } else {
      res.status(200).json(allHash)
    }
  } catch(e){
    console.log(e)
    res.status(500).json(false)
  }
})

app.get('/you/messages', nocache, mustSignIn, async function(req, res){
  try {
    let who = await db.User.findByUsername(req.session.user)
    if(!who) throw "User not found"

    let messages = await who.getMessagesRaw()
    for(let i = 0; i < messages.length; i++) {
      messages[i] = await db.User.inflateMessage(messages[i], req.session.user)
    }

    res.render('partials/messages', {
      user: req.session.user,
      csrfToken: req.csrfToken(),
      messages,
      layout: false
    })
  } catch(e){
    console.log(e)
    res.status(500).json(false)
  }
})

app.post('/you/messages/mark', nocache, mustSignIn, async function(req, res){
  try {
    let who = await db.User.findByUsername(req.session.user)
    if(!who) throw "User not found"

    let markAsRead = req.body.mark || []
    for(let message of markAsRead) {
      await who.markMessageRead(message)
    }
    res.status(200).json(true)
  } catch(e) {
    console.log(e)
    res.status(500).json(false)
  }
})

app.get('/users/:who', nocache, async function(req, res) {
  let who = await db.User.find({
    username: req.params.who
  })

  if(who[0]) {
    who[0].exists = true
    who[0].isYou = who[0].username === req.session.user

    let shared = await db.Collection.findOne({
      owners: who[0].username,
      isShared: true
    })

    let rs = []
    if(shared) {
      let rsRaw = await shared.getItems()
      for(let resource of rsRaw.items){
        let isResource = resource.kind == 'Resource'
        rs.push({ isResource, item: resource.item })
      }
    }

    res.render('user', {
      user: req.session.user,
      resources: rs,
      sharedId: shared ? shared._id : false,
      who: who[0],
      csrfToken: req.csrfToken(),
      title: who[0].username
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
    let user = await db.User.findOne({
      username: req.params.who
    })
    if(!user){
      req.status(404).json(false)
      return
    }

    if(req.body.md) {
      user.updateAbout(req.body.md)
      await user.save()
    }

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
    // fallback to opensprites logo
    res.redirect('/assets/img/logo/icon.png')
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

  if(requireEmailConfirmedToShare && !req.session.udata.emailConfirmed) {
    res.status(403).json({success: false, message: "Email not confirmed"})
    return
  }

  try {
     let collection = await db.Collection.findOne({
      owners: req.session.user,
      isShared: true
    }, '_id')

    if(collection) {
      collection = collection
    } else {
      collection = new db.Collection({
        _id: db.mongoose.Types.ObjectId(),
        name: 'Shared',
        owners: [req.session.user],
        isShared: true
      })
      await collection.save()
    }

    let file = req.file
    if(!file){
      res.status(400).json({success: false, message: "Missing file"})
      return
    }

    if(file.mimetype == "image/jpeg") {
      // Remove EXIF data
      console.log("User is uploading a JPEG, removing EXIF data")
      try {
        let imageOld = "data:image/jpeg;base64," + file.buffer.toString("base64")
        let imageNew = piexif.remove(imageOld).substring(imageOld.indexOf(','))
        file.buffer.write(imageNew, "base64")
      } catch(e) {
        console.log(e)
      }
    }

    let name = req.body.name
    let clientid = req.body.clientid


    let isAudio = file.mimetype.substr(0, 5) === 'audio'
    let isImage = file.mimetype.substr(0, 5) === 'image'
    let isScript = file.mimetype === 'application/json'
    console.log(file.mimetype)

    if(!isAudio && !isImage && !isScript) {
      res.status(400).json({success: false, message: "Unsupported type"})
      return
    }

    if(isImage) {
      file.buffer = await minify(file.buffer)
    }

    let thumb

    let resource = new db.Resource({
      _id: db.mongoose.Types.ObjectId(),
      owners: [ req.session.user ],
      name: name,
      type: file.mimetype,
      fname: name,
      audio: isAudio,
      image: isImage,
      script: isScript,
      loading: false, // unused now
      when: Date.now(),
      cover: name,
      data: '',
      downloads: 0,
      thumbnail: ''
    })

    let id = resource._id.toString()

    let where = path.join(__dirname, '../', 'db/uploads/', sanitize(id) + '.dat')
    if(process.env.db_file_storage == "true"){
      where = 'dbstorage/' + sanitize(id) + '.dat'
    }

    resource.data = where
    resource.thumbnail = where + '.thumb'

    if(isAudio) {
      let pngURI = trianglify({
        width: 240,
        height: 240,
        seed: name
      }).png()

      let data = pngURI.substr(pngURI.indexOf('base64') + 7)
      thumb = new Buffer(data, 'base64')
    }

    if(isImage) {
      let type = file.mimetype.split("/")
      if(type.length < 2){
        res.status(400).json({success: false, message: "Unrecognized image type"})
        return
      } else {
        type = type[1]
      }

      if(type === 'svg+xml') {
        thumb = file.buffer // await squishSVG(file.buffer)
      } else {
        thumb = await squish(file.buffer, type)
      }
    }

    if(isScript) {
      thumb = file.buffer
    }

    await resource.uploadThumbnail(thumb)

    await resource.uploadContent(file.buffer)

    await resource.save()

    // no need to download the items list
    await db.Collection.findOneAndUpdate(
      {_id: collection._id},
      {$push: {items: {kind: 'Resource', item: resource._id}}},
      {safe: true, upsert: true})

    console.log(`${req.session.user} uploaded "${name}" ${tada}`)
    res.json({success: true, message: "File uploaded", clientid: clientid, osurl: '/resources/' + id})
  } catch(err){
    console.log(err)
    res.status(500).json({success: false, message: err})
  }
})

app.get('/collections/create', async function(req, res) {
  if(!req.session.user) {
    req.session.r = req.originalUrl
    res.redirect('/signin')

    return
  }

  req.session.csrf = req.csrfToken() // bit hacky
  res.render('collection_create', {
    user: req.session.user,
    title: 'Create Collection',
    csrfToken: req.csrfToken()
  })
})

app.post('/collections/create', nocache, async function(req, res){
  if(!req.session.user) {
    req.session.r = req.originalUrl
    res.redirect('/signin')

    return
  }

  try {
    let shared = await db.Collection.findOne({
      owners: req.session.user,
      isShared: true
    }, '_id')

    if(!shared) {
      shared = new db.Collection({
        _id: db.mongoose.Types.ObjectId(),
        name: 'Shared',
        owners: [req.session.user],
        isShared: true
      })
      await shared.save()
    }


    let collection = new db.Collection({
      _id: db.mongoose.Types.ObjectId(),
      name: req.body.collectionName || 'Untitled Collection',
      owners: [req.session.user],
      isShared: false
    })
    await collection.save()

    await db.Collection.findOneAndUpdate(
      {_id: shared._id},
      {$push: {items: {kind: 'Collection', item: collection._id}}},
      {safe: true, upsert: true})

    res.redirect('/collections/' + collection._id)
  } catch(e){
    console.log(e)
    res.status('500').render('500', {user: req.session.user})
  }
})

app.post('/collections/download', nocache, async function(req, res) {
  try {
    let preparedFile = await scratchBuilder.prepare(req.body)
    res.json({success: true, message: 'ok', downloadId: preparedFile})
  } catch(e){
    console.log(e)
    res.status(500).json({success: false, message: e})
  }
})

app.get('/collections/download/:downloadId/:name', nocache, async function(req, res){
  try {
    scratchBuilder.download(req.params.downloadId, req.params.name, req, res)
  } catch(e){
    console.log(e)
    res.status(404).render('404', {user: req.session.user})
  }
})

app.get('/collections/:id', nocache, async function(req, res) {
  try {
    let collection = await Collection.findById(req.params.id)
    if(!collection) throw 'Collection not found'
    let rsRaw = await collection.getItems()
    let rs = []
    for(let resource of rsRaw.items){
      let isResource = resource.kind == 'Resource'
      rs.push({ isResource, item: resource.item })
    }

    collection.youOwn = await collection.isPermitted(req.session.user || '', 'owns')
    collection.canSetTitle = await collection.isPermitted(req.session.user || '', 'setTitle')
    collection.canSetAbout = await collection.isPermitted(req.session.user || '', 'setAbout')
    collection.canAddItems = await collection.isPermitted(req.session.user || '', 'addItems')
    collection.canRemoveItems = await collection.isPermitted(req.session.user || '', 'removeItems')

    if(collection.isShared) {
      collection.canRemoveItems = false
      collection.canAddItems = false
    }

    res.render('collection', {
      user: req.session.user,
      collection: collection,
      resources: rs,
      csrfToken: req.csrfToken()
    })
  } catch(err){
    console.log(err)
    res.status(404).render('404', {
      user: req.session.user
    })
  }
})

app.get('/collections/:id/items', nocache, async function(req, res) {
  try {
    let collection = await Collection.findById(req.params.id)
    if(!collection) throw 'Collection not found'
    let rsRaw = await collection.getItems()
    let rs = []
    for(let resource of rsRaw.items){
      let isResource = resource.kind == 'Resource'
      rs.push({ isResource, item: resource.item })
    }

    collection.youOwn = await collection.isPermitted(req.session.user || '', 'owns')
    collection.canSetTitle = await collection.isPermitted(req.session.user || '', 'setTitle')
    collection.canSetAbout = await collection.isPermitted(req.session.user || '', 'setAbout')
    collection.canAddItems = await collection.isPermitted(req.session.user || '', 'addItems')
    collection.canRemoveItems = await collection.isPermitted(req.session.user || '', 'removeItems')

    if(collection.isShared) {
      collection.canRemoveItems = false
      collection.canAddItems = false
    }

    res.render('partials/collection_items', {
      user: req.session.user,
      collection: collection,
      resources: rs,
      csrfToken: req.csrfToken(),
      layout: false
    })
  } catch(err){
    console.log(err)
    res.status(404).render('404', {
      user: req.session.user
    })
  }
})


app.post('/collections/:id/items/delete', nocache, async function(req, res) {
  try {
    let collection = await db.Collection.findById(req.params.id)
    if(!collection) throw {message: "Collection not found"};

    let permitted = await collection.isPermitted(req.session.user || '', 'removeItems')
    if(collection.isShared || !permitted){
      res.status(403).json(false)
      return
    }

    let items = req.body.ids
    if(!items){
      res.status(400).json(false)
      return
    }

    let removed = {}

    for(let item of items){
      let type = 'Resource'
      try {
        let resource = await db.Resource.findById(item)
        if(!resource) throw "Resource not found"
      } catch(e) {
        try {
          let collection = await db.Collection.findById(item)
          if(!collection) throw "Collection not found"
          type = 'Collection'
        } catch(e){
          removed[item] = {status: false, message: "not found"}
          continue
        }
      }
      await db.Collection.findOneAndUpdate(
        {_id: collection._id},
        {$pull: {items: { item:item, kind: type} }}
      )
      removed[item] = {status: true, message: "ok"}
    }

    res.status(200).json(removed)
  } catch(err) {
    if(err.message !== 'Invalid source') console.log(err)

    res.status(500).json(false)
  }
})

app.put('/collections/:id/items', nocache, async function(req, res) {
  try {
    let collection = await db.Collection.findById(req.params.id)
    if(!collection) throw {message: "Collection not found"};

    let permitted = await collection.isPermitted(req.session.user || '', 'addItems')
    if(collection.isShared || !permitted){
      res.status(403).json(false)
      return
    }

    let items = req.body.ids
    if(!items){
      res.status(400).json(false)
      return
    }

    let added = {}

    for(let item of items) {
      let type = 'Resource'
      try {
        let resource = await db.Resource.findById(item)
        if(!resource) throw "Resource not found"
      } catch(e) {
        try {
          let collection = await db.Collection.findById(item)
          if(!collection) throw "Collection not found"
          type = 'Collection'
        } catch(e){
          added[item] = {status: false, message: "That item doesn't exist"}
          continue
        }
      }
      let exists = await db.Collection.findOne({
        _id: collection._id,
        'items.item': item
      })
      if(exists) {
        added[item] = {status: false, message: "That item is already in the collection"}
        continue
      }

      await db.Collection.findOneAndUpdate(
        {_id: collection._id},
        {$push: {items: {kind: type, item: item }}},
        {safe: true, upsert: true}
      )
      added[item] = {status: true, message: "ok"}
    }

    res.status(200).json(added)
  } catch(err) {
    if(err.message !== 'Invalid source') console.log(err)

    res.status(500).json(false)
  }
})

app.get('/collections/:id/cover', nocache, async function(req, res) {
  try {
    let collection = await db.Collection.findById(req.params.id)
    if(!collection) throw {message: "Collection not found"};

    let buf = await collection.getThumbnail()
    res.contentType('image/png').send(buf)
  } catch(err) {
    if(err.message !== 'Invalid source') console.log(err)

    res.redirect('/assets/img/logo/icon.png')
  }
})

app.put('/collections/:id/about', nocache, async function(req, res) {
  try {
    let collection = await db.Collection.findById(req.params.id)
    if(!collection) throw 'Collection not found'

    let canSetTitle = await collection.isPermitted(req.session.user || '', 'setTitle')
    let canSetAbout = await collection.isPermitted(req.session.user || '', 'setAbout')

    if(canSetAbout && req.body.md) {
      collection.updateAbout(req.body.md)
    } else if(!canSetAbout) {
      res.status(403).json(false)
      return
    }

    if(canSetTitle && req.body.title) {
      collection.updateTitle(req.body.title)
    } else if(!canSetTitle) {
      res.status(403).json(false)
      return
    }

    await collection.save()

    res.status(200).json({about: collection.about, title: collection.name})
  } catch(err){
    console.log(err)
    res.status(404).json(false)
  }
})

app.put('/collections/:id/permissions', nocache, async function(req, res){
  try {
    let collection = await Collection.findById(req.params.id)
    if(!collection) throw "Collection not found"

    let permissions = req.body.permissions
    if(permissions){
      let permitted = await collection.isPermitted(req.session.user, 'setPermissions')
      if(!permitted){
        res.status(403).json(false)
        return
      }


      collection.setPermissions(permissions)

      await collection.save()
      res.status(200).json(true)
    } else {
      res.status(400).json(false)
    }
  } catch(e){
    console.log(e)
    res.status(404).json(false)
  }
})

app.get(`/resources/:id`, nocache, async function(req, res) {
  let resource = await db.Resource.find({
    _id: req.params.id
  })

  if(resource[0] && !resource[0].deleted && req.get('accept').indexOf('text/html') < 0 && resource[0].image) {
    resource[0].downloadToResponse(req, res)
    return
  }

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

    // TODO: perhaps this should be done during
    // upload processing instead of first view?
    if(resource[0].image && !resource[0].place && resource[0].type != 'image/svg+xml') {
      try {
        const data = await resource[0].download()
        const place = await cubeupload(data, resource[0].type)

        if(place.error || !place.file_name) throw 'Failed to upload to CubeUpload'
        resource[0].place = 'http://i.cubeupload.com/' + place.file_name
        await resource[0].save()
      } catch(e) {
        console.log(e)
      }
    }

    if(resource[0].place) {
      var forums_url = '[img]' + resource[0].place + '[/img]'
    }

    resource[0].comments.reverse()

    res.render('resource', {
      user: req.session.user,
      u: user,
      host: req.get('host'),
      resource: resource[0],
      csrfToken: req.csrfToken(),
      title: resource[0].name,
      forums_url,
      youOwn: resource[0].owners.indexOf(req.session.user||'') > -1,
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
    resource = await db.Resource.findById(req.params.id)
  } catch(err) {
    console.log(err)
    res.status(404).json(false)
    return
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
    resource = await db.Resource.findById(req.params.id)
  } catch(err){
    console.log(err)
    res.status(404).render('404', {
      user: req.session.user
    })
    return
  }

  if(resource.image){
    try {
      let thumb

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
    resource = await db.Resource.findById(req.params.id)
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
      for(let owner of resource.owners) {
        let u = User.findByUsername(owner)
        if(owner != req.session.user)
          u.sendMessage('download', 'resource', 'Resource', resource._id, 1)
      }
    } catch(err){
      console.log(err)
      // continue to download anyway
    }
    if(resource.script) {
      let preparedId = await scratchBuilder.prepare({
        type: 'sprite',
        which: [
          resource._id
        ]
      })
      console.log('prepared: ', preparedId)
      res.redirect(`/collections/download/${preparedId}/${req.params.f.replace('.json', '')}`)
      return
    }
    res.set("Content-Disposition", "attachment; filename=\"" + req.params.f + "\"")
    resource.downloadToResponse(req, res)
  }
})

// DEPRECATED
app.get(`/resources/:id/cover`, async function(req, res) {
 try {
    let resource = await db.Resource.findById(req.params.id)
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
    downloadedResources: await downloaded,
    csrfToken: req.csrfToken()
  })
})

/////////////////////////////////////////////////////////

app.get('/about', function(req, res) {
  let f = path.join(__dirname, '../', 'about.md')

  fs.readFile(f, 'utf8', function(err, file) {
    res.render('md-page', {
      user: req.session.user,
      title: 'About',
      markdown: file || 'Not found!'
    })
  })
})

app.get('/contact-us', function(req, res) {
  res.render('contact-us', {
    user: req.session.user,
    title: 'Contact OpenSprites'
  })
})

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

console.info("Load took " + ((Date.now() - startLoad)/1000) + " secs")

db.load().then(function() {
  const port = process.env.server_port || 3000

  app.listen(port, function() {
    console.log('Listening on http://localhost:' + port + ' ' + tada)
  })
})
