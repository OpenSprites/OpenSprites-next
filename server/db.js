const mongoose = require('mongoose')
mongoose.connect(`mongodb://${process.env.db_user}:${process.env.db_pass}@${process.env.db_host}/${process.env.db_name}`)

mongoose.Promise = Promise

let db = mongoose.connection
db.on('error', console.error.bind(console, 'Connection error:'))

/////////////////////////////////////////////////////////

const Resource = mongoose.model('Resource', mongoose.Schema({
  _id: String,
  name: { type: String, default: 'Something' },
  about: { type: String, default: '' },
  type: { type: String, enum: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg',
    'audio/mp3',
    'audio/wav',
    'script/scratch-json'
  ] },
  data: Buffer,
  owners: { type: Array, default: [] },
  when: String,
}))

const Collection = mongoose.model('Collection', mongoose.Schema({
  _id: String,
  name: { type: String, default: 'A Collection' },
  about: { type: String, default: '' },
  resources: [ String ],
  owners: { type: Array, default: [] },
  isShared: { type: Boolean, default: false }
}))

const User = mongoose.model('User', mongoose.Schema({
  username: String,
  password: String,
  admin: { type: Boolean, default: false },

  email: String,
  emailConfirmed: { type: Boolean, default: false },

  joined: { type: String, default: Date.now() },
  about: { type: String, default: '# About Me\nHi there!' }
}))

/////////////////////////////////////////////////////////

module.exports = {
  User,
  Resource,
  Collection,

  load: function() {
    return new Promise(function(done, reject) {
      db.once('open', function() {
        done()
      })
    })
  }
}