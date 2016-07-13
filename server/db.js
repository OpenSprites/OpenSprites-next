const mongoose = require('mongoose')
const Grid = require('gridfs-locking-stream')
const shortid = require('shortid')
Grid.mongo = mongoose.mongo

/////////////////////////////////////////////////////////

const User = mongoose.model('User', mongoose.Schema({
  username: String,
  password: String,
  admin: { type: Boolean, default: false },

  email: String,
  emailConfirmed: { type: Boolean, default: false },

  joined: { type: String, default: () => Date.now() },
  about: { type: String, default: 'Hi there!' },

  online: { type: Number, default: () => Date.now() }, // last seen
  ip: [
    String
  ]
}))

/////////////////////////////////////////////////////////

module.exports = {
  User,
  
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
