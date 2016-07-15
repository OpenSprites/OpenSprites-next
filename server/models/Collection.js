const mongoose = require('mongoose')
const db = require('../db')
const replaceBadWords = require('../utils/replace-bad-words.js')
const lwip = require('lwip')
const callbackToPromise = require('../utils/callback-to-promise')

let CollectionSchema = mongoose.Schema({
  name: { type: String, default: 'A Collection' },
  about: { type: String, default: `Hello there! I'm a collection without a description.` },
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
})

let Collection

CollectionSchema.methods.updateAbout = function (about) {
  about = replaceBadWords(about)
  if (about.length > 1024) about = about.substr(0, 1024)
  this.about = about
}

CollectionSchema.methods.updateTitle = function (title) {
  let name = replaceBadWords(title).replace(/[\r\n]/g, '')
  if (name.length > 256) name = name.substr(0, 256)
  this.name = name
}

CollectionSchema.methods.setPermissions = function (newPermsObj) {
  let self = this
  let updateFor = function (who, objNode) {
    for (let key in objNode) {
      self.permissions[who][key] = objNode[key]
    }
  }
  if (newPermsObj.curators) updateFor('curators', newPermsObj.curators)
  if (newPermsObj.everyone) updateFor('everyone', newPermsObj.everyone)
}

CollectionSchema.methods.isPermitted = async function (user, permission) {
  let userObj = await db.User.findOne({
    username: user
  });
  if (!userObj) return false;
  if (userObj.admin) return true

  let isOwner = !!(await Collection.findOne({
    _id: this._id,
    owners: userObj.username
  }))
  
  if (permission == 'setPermissions' || permission == 'owns') {
    return isOwner
  } else if(isOwner) {
    return true
  }

  let group = 'everyone'
  if (await Collection.findOne({
      _id: this._id,
      curators: userObj.username
    })) {
    group = 'curators'
  }

  return this.permissions[group][permission]
}

CollectionSchema.methods.getItems = function (limit, maxDate) {
  let populateParams = {
    path: 'items.item',
    sort: '-when',
    select: {
      name: 1,
      audio: 1,
      image: 1,
      deleted: 1,
      _id: 1,
      owners: 1,
      when: 1,
      data: 1,
      type: 1
    }
  }
  if (limit) {
    populateParams.options = {
        limit: limit
      } // see: http://stackoverflow.com/a/23640287/1021196
    if (maxDate) {
      populateParams.select['when'] = {
        $lte: maxDate
      }
    }
  }
  return db.Collection.findOne({
    _id: this._id
  }, 'items').populate(populateParams)
}

CollectionSchema.methods.getThumbnail = async function(){
  let rsRaw = await this.getItems(10)
  let rs = []
  const Resource = mongoose.models.Resource
  for(let resource of rsRaw.items){
    if(resource.kind != 'Resource') continue
    rs.push(await Resource.findById(resource.item._id))
  }
  
  let $ = callbackToPromise
  
  let image = await $(lwip, lwip.create, 240, 240, {r:0, g:0, b:0, a:0})
    
  for(var i = 0; i < Math.min(rs.length, 4); i++) {
    let thumbData = await rs[i].getThumbnail()
    let thumb = await $(lwip, lwip.open, thumbData.data, 'png')
    thumb = await $(thumb, thumb.cover, 120, 120, "lanczos")
    let x = (i % 2 == 0) ? 0 : 120
    let y = (i < 2) ? 0 : 120
    image = await $(image, image.paste, x, y, thumb)
  }
    
  let buf = await $(image, image.toBuffer, 'png')
  return buf
}

CollectionSchema.statics.findById = async function (id, whichFields) {
  let promise
  if (whichFields) {
    promise = Collection.findOne({
      _id: id
    }, whichFields)
  } else {
    promise = Collection.findOne({
      _id: id
    }, 'name about permissions when owners isShared')
  }
  let result = await promise
  if (!result) throw "Collection not found"
  return result
}

CollectionSchema.statics.create = function (data) {
  return new Collection(data)
}

Collection = mongoose.model('Collection', CollectionSchema)

module.exports = Collection