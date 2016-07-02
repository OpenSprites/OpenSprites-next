/**
 * server/db.js
 * ------------
 * 
 * Reading 200 JSON files at once since 1999
 */

const sanitize = require('sanitize-filename')
const bcrypt = require('bcrypt-as-promised')
const ndjson = require('ndjson')
const request = require('request-promise')
const fs = require('fs')

// for(let [key, value] of entries(obj)) { ... }
function* entries(obj) {
  for(let key of Object.keys(obj)) {
    yield [key, obj[key]]
  }
}

// users.json is append-only! :tada:
let userStream = fs.createWriteStream('db/users.json', { flags: 'a' })

let db = {
  // use `db.user.get` and `db.user.set` rather
  // than editing/reading this object directly.
  users: {},

  user: {
    get: function(who) {
      return db.users[who] || {}
    },

    exists: function(who) {
      return typeof db.users[who] !== 'undefined'
    },

    set: function(who, data) {
      db.users[who] = data
      userStream.write(JSON.stringify(data) + '\n')
    },

    // auth //

    signIn: async function(who, password) {
      let user = db.user.get(who)

      if(!user) {
        return false
      }

      try {
        await bcrypt.compare(password, user.password)
        return true
      } catch(e) {
        return false
      }
    },

    join: async function(data) {
      if(db.user.exists(data.username)) {
        return false
      }

      let udata = await request(`https://api.scratch.mit.edu/users/${data.username}`, { json: true })

      data.password = await bcrypt.hash(data.password, 12)
      data.admin = data.admin || false
      data.emailConfirmed = data.emailConfirmed || false
      data.joined = Date.now()
      data.country = udata.country
      data.about = udata.bio || 'Hello, World!'
      data.username = udata.username

      db.user.set(data.username, data)

      return true
    }
  },

  load: {
    users: function() {
      return new Promise(function(done) {
        fs.createReadStream('db/users.json')
          .pipe(ndjson.parse({ strict: false }))
          .on('data', function(user) {
            db.users[user.username] = user
          })
          .on('end', async function() {
            await db.compact.users()
            done()
          })
      })
    }
  },

  compact: {
    users: function() {
      return new Promise(function(done) {
        let squish = fs.createWriteStream('db/users.json')
        for(let [username, user] of entries(db.users)) {
          squish.write(JSON.stringify(user) + '\n')
        }

        done()
      })
    }
  }
}

module.exports = db

