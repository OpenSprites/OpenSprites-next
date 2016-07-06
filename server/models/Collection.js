const db = require('../db')
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
      })
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
  
  save() {
    return this._mongoDoc.save()
  }
}
Collection.schema = db.Collection

module.exports = Collection