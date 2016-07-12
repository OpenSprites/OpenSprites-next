const db = require('../db')
const Resource = require('./Resource')
const replaceBadWords = require('../utils/replace-bad-words.js')

class Collection {
  static async findById(id, whichFields) {
    let promise
    if(whichFields){
      promise = db.Collection.findOne({
        _id: id
      }, whichFields)
    } else {
      promise = db.Collection.findOne({
        _id: id
      }, 'name about permissions when owners')
    }
    let result = await promise
    if(!result) throw "Collection not found"
    return new Collection(result)
  }
  
  static create(data){
    return new Collection(new Collection.schema(data))
  }
  
  constructor(data) {
    this._mongoDoc = data
    data = JSON.parse(JSON.stringify(data)) // HACKY
    for(let key in data){
      if(data.hasOwnProperty(key)){
        Object.defineProperty(this, key, {
          enumerable: true,
          get: (function(key){
            return this._mongoDoc[key]
          }).bind(this, key),
          set: (function(key, value){
            this._mongoDoc[key] = value
          }).bind(this, key)
        })
      }
    }
  }
  
  updateAbout(about){
    about = replaceBadWords(about)
    if(about.length > 1024) about = about.substr(0, 1024)
    this.about = about
  }
  
  updateTitle(title){
    let name = replaceBadWords(title).replace(/[\r\n]/g, '')
    if(name.length > 256) name = name.substr(0, 256)
    this.name = name
  }
  
  setPermissions(newPermsObj){
    let self = this
    let updateFor = function(who, objNode){
      for(let key of objNode){
        this.permissions[who][key] = objNode[key]
      }
    }
    if(newPermsObj.curators) updateFor('curators', newPermsObj.curators)
    if(newPermsObj.everyone) updateFor('everyone', newPermsObj.everyone)
  }
  
  async isPermitted(user, permission){
    let userObj = db.User.findOne({ username: user })
    if(userObj.admin) return true
    
    if(permission == 'setPermissions' || permission == 'owns'){
      return !!(await db.Collection.findOne({_id: this._id, owners: userObj._id}))
    }
    
    let group = 'everyone'
    if(await db.Collection.findOne({_id: this._id, curators: userObj._id})) {
      group = 'curators'
    }
    
    return this.permissions[group][permission]
  }
  
  getItems(limit, maxDate) {
    let populateParams = {
      path: 'items.item',
      sort: '-when',
      select: {name:1, audio:1, image:1, deleted:1, _id:1, owners:1}
    }
    if(limit){
      populateParams.options = { limit: limit } // see: http://stackoverflow.com/a/23640287/1021196
      if(maxDate) {
        populateParams.select['when'] = { $lte: maxDate }
      }
    }
    return db.Collection.findOne({_id: this._id}, 'items').populate(populateParams)
  }
  
  save() {
    return this._mongoDoc.save()
  }
}
Collection.schema = db.Collection

module.exports = Collection
