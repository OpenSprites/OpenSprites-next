const mongoose = require('mongoose')
mongoose.connect(`mongodb://${process.env.db_user}:${process.env.db_pass}@${process.env.db_host}/${process.env.db_name}`)

mongoose.Promise = Promise

let db = mongoose.connection
db.on('error', console.error.bind(console, 'Connection error:'))

/////////////////////////////////////////////////////////

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

  load: function() {
    return new Promise(function(done, reject) {

      db.once('open', function() {
        done()
      })

    })
  }
}