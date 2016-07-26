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

UserSchema.methods.sendMessage = async function(type, subtype, refKind, refId) {
   await User.findOneAndUpdate(
    {_id: this._id},
    {$push: {messages: {
      where: {kind: refKind, item: refId},
      type,
      subtype
    }}},
    {safe: true, upsert: true})
}

UserSchema.methods.getMessagesRaw = async function(num) {
  if(!num) num = 5
  
  let user = await User.findOne({_id: this._id}, {messages: {$slice: -num}})
  return user.messages
}

UserSchema.statics.findByUsername = async function(username, whichFields) {
  let promise
  if (whichFields) {
    promise = User.findOne({
      username
    }, whichFields)
  } else {
    promise = User.findOne({
      username
    }, 'username password admin email emailConfirmed joined about online ip')
  }
  let result = await promise
  if (!result) throw "User not found"
  return result
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
    }, 'username password admin email emailConfirmed joined about online ip')
  }
  let result = await promise
  if (!result) throw "User not found"
  return result
}

User = mongoose.model('User', UserSchema)

module.exports = User