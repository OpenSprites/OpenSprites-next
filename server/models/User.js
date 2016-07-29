const mongoose = require('mongoose')
const db = require('../db')
const Resource = require('./Resource')
const Collection = require('./Collection')
const replaceBadWords = require('../utils/replace-bad-words.js')

let MessageSchema = mongoose.Schema({
  type: { type: String, enum: ['comment', 'download', 'collection_add', 'forum_activity'] },
  subtype: { type: String, enum: ['resource', 'collection', 'profile', 'reply', 'forum_section', 'forum_topic'] },
  where: {
    kind: String,
    item: { type: mongoose.Schema.Types.ObjectId, refPath: 'where.kind' }
  },
  count: { type: Number, default: -1 },
  read: { type: Boolean, default: false },
  when: { type: Number, default: () => Date.now() }
})

let AlertSchema = mongoose.Schema({
  from: String,
  message: String,
  when: { type: Number, default: () => Date.now() },
  read: { type: Boolean, default: false }
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

UserSchema.index({username: 'text', about: 'text'})

let User

UserSchema.methods.updateAbout = function (about) {
  about = replaceBadWords(about)
  if (about.length > 1024) about = about.substr(0, 1024)
  this.about = about
}

UserSchema.methods.sendMessage = async function(type, subtype, refKind, refId, count) {
  if(!count) count = 0
  
  let recentMessages = await this.getMessagesRaw(5)
  let updateMessageId = null
  let updateMessageCount = null
  for(let recentMessage of recentMessages) {
    if(recentMessage.type == type && recentMessage.subtype == subtype && recentMessage.kind == refKind && recentMessage.refId.toString() == refId.toString()) {
      updateMessageId = recentMessage._id
      updateMessageCount = recentMessage.count + count
      break
    }
  }
  
  if(updateMessageId) {
    await User.findOneAndUpdate({
      _id: this._id,
      'messages._id': updateMessageId
    }, {
      $set: { 'messages.$.read': false, 'messages.$.count': updateMessageCount }
    })
    return
  }
  
  await User.findOneAndUpdate(
    {_id: this._id},
    {$push: {messages: {
      where: {kind: refKind, item: refId},
      type,
      subtype,
      count
    }}},
    {safe: true, upsert: true})
}

UserSchema.methods.getMessagesRaw = async function(num) {
  if(!num) num = 5
  
  let user = await User.findOne({_id: this._id}, {messages: {$slice: -num}})
  let messages = user.messages
  messages.reverse()
  return messages
}

UserSchema.methods.markMessageRead = async function(messageId) {
  await User.findOneAndUpdate({
    _id: this._id,
    'messages._id': messageId
  }, {
    $set: { 'messages.$.read': true }
  })
}

UserSchema.statics.inflateMessage = async function(message, loggedInUser) {
  let messageContents = []
  messageContents._id = message._id
  messageContents.read = message.read
  let rs, cl, u
  switch(message.type) {
    case 'comment':
      if(message.subtype == 'reply') {
        messageContents.push({icon: 'reply'})
        messageContents.push({ label: message.count + ' new ' + (message.count == 1 ? 'reply' : 'replies')+ ' on'})
      } else {
        messageContents.push({icon: 'comment'})
        messageContents.push({ label: message.count + ' new ' + (message.count == 1 ? 'comment' : 'comments')+ ' on'})
      }
      if(message.where.kind == 'Resource') {
        rs = await Resource.findById(message.where.item)
        messageContents.push({ label: rs.name, href: '/resources/' + rs._id })
      } else if(message.where.kind == 'Collection') {
        cl = await Collection.findById(message.where.item)
        messageContents.push({ label: cl.name, href: '/collections/' + cl._id })
      } else if(message.where.kind == 'User') {
        u = await User.findById(message.where.item)
        if(u.username == loggedInUser) {
          messageContents.push({ label: 'your profile', href: '/you' })
        } else {
          messageContents.push({ label: u.username + '\'s profile', href: '/users/' + u.username })
        }
      }
      break
    case 'download':
      messageContents.push({icon: 'file_download'})
      messageContents.push({ label: message.count + ' ' + (message.count == 1 ? 'person' : 'people') + ' downloaded' })
      if(message.subtype == 'resource') {
          rs = await Resource.findById(message.where.item)
          messageContents.push({ label: rs.name, href: '/resources/' + rs._id })
      } else if(message.subtype == 'collection') {
        cl = await Collection.findById(message.where.item)
        messageContents.push({ label: cl.name, href: '/collections/' + cl._id })
      }
      break
    case 'collection_add':
      messageContents.push({icon: 'library_add'})
      messageContents.push({ label: message.count + ' ' + (message.count == 1 ? 'item' : 'items') + ' added to' })
      cl = await Collection.findById(message.where.item)
      messageContents.push({ label: cl.name, href: '/collections/' + cl._id })
      break
    case 'forum':
      messageContents.push({icon: 'collection_add'})
      messageContents.push({label: 'Sample Text'})
      break
  }
  return messageContents
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