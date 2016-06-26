/**
 * server/db.js
 * ------------
 * 
 * Reading 200 JSON files at once since 1999
 */

const fsp = require('mz/fs')
const jsonp = require('json-promise')
const sanitize = require('sanitize-filename')
const bcrypt = require('bcrypt-as-promised')

const db = {
  users: { get: async function(gibAllDaData) {
    let users = await fsp.readdir('db/user')
    users = users.map(name => name.substr(0, name.length - 5))

    // eventually this'll get quite slow, so only use it for
    // debugging/admin pl0x.
    if(gibAllDaData) {
      let us = []

      for(let i = 0; i < users.length; i++) {
        let u = await db.user.get(users[i])
        us.push(u)
      }

      users = us
    }

    return users
  }},

  user: {
    get: async function(who) {
      if(!db.user.exists(who))
        return { exists: false }

      let user = await fsp.readFile(`db/user/${sanitize(who)}.json`, 'utf8')
      user = await jsonp.parse(user)
      user.exists = true

      return user
    },

    exists: async function(who) {
      let exists = await fsp.exists(`db/user/${sanitize(who)}.json`)
      return exists
    },

    set: async function(who, data) {
      let k = await jsonp.stringify(data)
      await fsp.writeFile(`db/user/${sanitize(who)}.json`, k, 'utf8')
    },

    // auth //

    signIn: async function(who, password) {
      let user = await db.user.get(who)

      if(!user.exists)
        return false

      try {
        await bcrypt.compare(password, user.password)
        return true
      } catch(e) {
        return false
      }
    },

    join: async function(data) {
      let exists = await db.user.exists(data.username)

      if(exists)
        return false

      data.password = await bcrypt.hash(data.password, 12)
      data.admin = data.admin || false
      data.emailConfirmed = data.emailConfirmed || false
      data.joined = Date.now()

      db.user.set(data.username, data)

      return true
    }
  } 
}

module.exports = db