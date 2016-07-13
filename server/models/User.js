const mongoose = require('mongoose')
const db = require('../db')
const replaceBadWords = require('../utils/replace-bad-words.js')

let MessageSchema = mongoose.Schema({
  type: { type: String, enum: ['comment', 'download', 'collection_add', 'forum_activity'] },
  subtype: { type: String, enum: ['resource', 'collection', 'profile', 'forum_section', 'forum_topic'] },
  where: {
    kind: String,
    item: { type: mongoose.Schema.Types.ObjectId, refPath: 'where.kind' }
  },
  when: { type: Number, default: () => Date.now() }
})

let AlertSchema = mongoose.Schema({
  from: String,
  message: String,
  when: { type: Number, default: () => Date.now() }
})

let UserSchema = mongoose.Schema({
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
  ],
  
  messages: [ MessageSchema ],
  alerts: [ AlertSchema ]
})

let User

UserSchema.methods.updateAbout = function (about) {
  about = replaceBadWords(about)
  if (about.length > 1024) about = about.substr(0, 1024)
  this.about = about
}

UserSchema.statics.findById = async function (id, whichFields) {
  let promise
  if (whichFields) {
    promise = User.findOne({
      _id: id
    }, whichFields)
  } else {
    promise = User.findOne({
      _id: id
    })
  }
  let result = await promise
  if (!result) throw "User not found"
  return result
}

User = mongoose.model('User', UserSchema)

module.exports = User