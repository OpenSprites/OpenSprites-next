const mongoose = require('mongoose')
const Grid = require('gridfs-locking-stream')
const shortid = require('shortid')
Grid.mongo = mongoose.mongo

/////////////////////////////////////////////////////////

const Collection = mongoose.model('Collection', mongoose.Schema({
  name: { type: String, default: 'A Collection' },
  about: { type: String, default: 'Sample Text' },
  items: [
    {
      kind: String,
      item: { type: mongoose.Schema.Types.ObjectId, refPath: 'items.kind' }
    }
  ],
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

  joined: { type: String, default: () => Date.now() },
  about: { type: String, default: '# About Me\nHi there!' },

  online: { type: Number, default: () => Date.now() }, // last seen
  ip: [
    String
  ]
}))

/////////////////////////////////////////////////////////

module.exports = {
  User,
  Collection,
  
  GridFS: null,
  mongoose: mongoose,
  
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
