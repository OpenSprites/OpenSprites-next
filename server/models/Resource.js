const db = require('../db')
const replaceBadWords = require('../utils/replace-bad-words.js')

class Resource {
  static async findById(id, whichFields) {
    let promise
    if(whichFields){
      promise = db.Resource.findOne({
        _id: id
      }, whichFields)
    } else {
      promise = db.Resource.findOne({
        _id: id
      })
    }
    let result = await promise
    if(!result) throw "Resource not found"
    return new Resource(result)
  }
  
  static create(data){
    return new Resource(new Resource.schema(data))
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
  
  uploadContent(buffer){
    return new Promise((function(resolve, reject){
      let where = this.data
      if(process.env.db_file_storage == "true"){
        var writestream = db.GridFS.createWriteStream({
            filename: where
        }, function(err, writestream){
          if(err){
            reject(err)
            return
          }
          writestream.on('error', function(err){
          reject(err)
          })
          writestream.on('finish', function(){
            resolve()
          })
          writestream.write(buffer)
          writestream.end()
        })
      } else {
        fs.writeFile(where, buffer, function(err) {
          if(err) {
            reject(err)
            return
          }
          resolve()
        })
      }
    }).bind(this))
  }
  
  uploadThumbnail(thumb) {
    return new Promise((function(resolve, reject){
      let where = this.data
      let isImage = this.image
      if(isImage) {
        if(process.env.db_file_storage == "true"){
          db.GridFS.createWriteStream({
            filename: where + '.thumb'
          }, function(err, writestream) {
            if(err) {
              reject(err)
              return
            }
            writestream.write(thumb)
            writestream.end()
            resolve()
          })
        } else {
          fs.writeFile(where + '.thumb', thumb, (err) => {
            if(err) {
              reject(err)
              return
            }
            resolve()
          })
        }
      } else {
        resolve()
      }
    }).bind(this))
  }
  
  save() {
    return this._mongoDoc.save()
  }
  
  getThumbnail(){
    return new Promise((function(resolve, reject){
      if(this._mongoDoc.audio) {
        resolve({
          contentType: 'image/svg+xml',
          data: this._mongoDoc.thumbnail
        })
      }
      
      if(this._mongoDoc.image) {
        let location = this._mongoDoc.data + '.thumb'
        if(location.startsWith('dbstorage/')) {
          db.GridFS.files.findOne({ filename: location }, function (err, file) {
            if(err){
              reject({'error' : 'Resource not found'})
              return
            }
            db.GridFS.createReadStream({
              _id: file._id
            }, function(err, readstream){
              if(err){
                reject({'error' : 'Unable to open database read stream'})
                return
              }
              var bufs = [];
              readstream.on('data', function(d){ bufs.push(d); });
              readstream.on('end', function(){
                var buf = Buffer.concat(bufs)
                resolve({
                  contentType: 'image/png',
                  data: buf
                })
              })
            })
          })
        } else {
          fs.readFile(location, (err, data) => {
            resolve({
              contentType: 'image/png',
              data: data
            })
          })
        }
      }
    }).bind(this))
  }
  
  async incrementDownloads(ip){
    if(!this.downloaders.includes(ip)) {
      this.downloads = (this.downloads || 0) + 1
      this.downloaders.push(ip)
      await this.save()
    }
  }
  
  downloadToResponse(req, res){
    let location = this.data
    let type = this.type
    if(location.startsWith('dbstorage/')) {
      db.GridFS.files.findOne({ filename: location }, function (err, file) {
        if(err){
          res.status(404).render('404', {
            user: req.session.user
          })
          return
        }
        let rangeRequest = req.range(file.length)
        let rsParams = { _id: file._id }
        let length = file.length
        if(rangeRequest == -1 || rangeRequest == -2){
          res.status(416)
          res.end()
          return
        } if(Array.isArray(rangeRequest) && rangeRequest.type === 'bytes' && rangeRequest.length > 0) {
          rsParams.range = {
            startPos: rangeRequest[0].start,
            endPos: rangeRequest[0].end
          }
          length = rsParams.range.endPos - rsParams.range.startPos + 1
          res.status(206)
          res.set('Content-Range', 'bytes ' + rsParams.range.startPos + '-' + rsParams.range.endPos + '/' + file.length)
        }
        
        db.GridFS.createReadStream(rsParams, function(err, readstream){
          if(err){
            res.status(500).json({'error' : 'Unable to open database read stream'}).end()
            return
          }
          readstream.on('error', function(err){
            res.status(500).json({'error' : 'Database read stream failed', 'errobj': err}).end()
          })
          res.contentType(type)
          res.set('Content-Length', length + '')
          res.set('Accept-Ranges', 'bytes')
          req.connection.on('close', (function(res, readstream){
            readstream.unpipe()
            res.end()
          }).bind(this, res, readstream));
          readstream.pipe(res)
        })
      })
    } else {
      fs.readFile(location, (err, data) => {
        res.contentType(type)
          .send(data)
      })
    }
  }
}
Resource.schema = db.Resource

module.exports = Resource