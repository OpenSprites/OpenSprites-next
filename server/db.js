const mongoose = require('mongoose')
const Grid = require('gridfs-locking-stream')
const shortid = require('shortid')
Grid.mongo = mongoose.mongo

/////////////////////////////////////////////////////////

const Reply = mongoose.Schema({
  _id: { type: String, default: shortid },
  who: { type: String, required: true },
  what: { type: String, default: '' },
  when: { type: Number, default: () => Date.now() }
})

const Comment = mongoose.Schema({
  _id: { type: String, default: shortid },
  who: { type: String, required: true },
  what: { type: String, default: '' },
  when: { type: Number, default: () => Date.now() },
  replies: [
    Reply
  ]
})

const Resource = mongoose.model('Resource', mongoose.Schema({
  _id: String,
  name: { type: String, default: 'Something' },
  about: { type: String, default: 'Sample Text' },
  type: { type: String, enum: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'audio/mp3',
    'audio/wav',
    'application/json'
  ] },

  audio: Boolean,
  image: Boolean,
  script: Boolean,
  sprite: Boolean,

  when: { type: Number, default: () => Date.now() },

  thumbnail: String,
  cover: String,

  deleted: { type: Boolean, default: false },
  comments: [
    Comment
  ],

  data: String, // db/uploads/_id.dat
  owners: { type: Array, default: [] },

  downloads: { type: Number, default: 0 },
  downloaders: [ String ]
}))

const Collection = mongoose.model('Collection', mongoose.Schema({
  _id: String,
  name: { type: String, default: 'A Collection' },
  about: { type: String, default: 'Sample Text' },
  resources: [ String ],
  owners: { type: Array, default: [] },
  curators: { type: Array, default: [] },
  subscribers: { type: Array, default: [] },
  permissions : {
    curators: {
      addCurators: { type: Boolean, default: false },
      addItems: { type: Boolean, default: true },
      removeItems: { type: Boolean, default: true },
      setTitle: { type: Boolean, default: false },
      setAbout: { type: Boolean, default: true }
    },
    everyone: {
      addCurators: { type: Boolean, default: false },
      addItems: { type: Boolean, default: false },
      removeItems: { type: Boolean, default: false },
      setTitle: { type: Boolean, default: false },
      setAbout: { type: Boolean, default: false }
    }
  },
  when: { type: Number, default: () => Date.now() },
  isShared: { type: Boolean, default: false }
}))

const User = mongoose.model('User', mongoose.Schema({
  username: String,
  password: String,
  admin: { type: Boolean, default: false },

  email: String,
  emailConfirmed: { type: Boolean, default: false },

  about: { type: String, default: '# About Me\nHi there!' },

  ip: [
    String
  ]
}))

/////////////////////////////////////////////////////////

module.exports = {
  User,
  Resource,
  Collection,
  
  GridFS: null,
  
  load: function() {
    return new Promise(function(done, reject) {
      console.log('Connecting to MongoDB...')
      mongoose.connect(`mongodb://${process.env.db_user}:${process.env.db_pass}@${process.env.db_host}/${process.env.db_name}`)

      mongoose.Promise = Promise

      let db = mongoose.connection
      db.on('error', e => {
        console.error('Error!', e.message)
        process.exit(1)
      })
      db.once('open', function() {
        console.log("Loading GridFS...")
        var gfs = Grid(db.db)
        module.exports.GridFS = gfs
        done()
      })
    })
  }
}