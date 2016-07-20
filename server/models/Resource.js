const fs = require('fs')
const replaceBadWords = require('../utils/replace-bad-words.js')
const mongoose = require('mongoose')
const db = require('../db')

const Reply = mongoose.Schema({
  who: { type: String, required: true },
  what: { type: String, default: '' },
  when: { type: Number, default: () => Date.now() }
})

let Comment = mongoose.Schema({
  who: { type: String, required: true },
  what: { type: String, default: '' },
  when: { type: Number, default: () => Date.now() },
  replies: [
    Reply
  ]
})

let ResourceSchema = mongoose.Schema({
  name: { type: String, default: 'Something' },
  about: { type: String, default: 'Sample Text' },
  type: { type: String, enum: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg+xml',
    'audio/mp3',
    'audio/wav',
    'application/json'
  ] },

  audio: Boolean,
  image: Boolean,
  script: Boolean,
  sprite: Boolean,

  when: { type: Number, default: () => Date.now() },

  thumbnail: String,
  cover: String,

  deleted: { type: Boolean, default: false },
  comments: [
    Comment
  ],

  data: String, // db/uploads/_id.dat
  wavCache: { type: String, default: "" },
  owners: { type: Array, default: [] },

  downloads: { type: Number, default: 0 },
  downloaders: [ String ]
})

let Resource

ResourceSchema.methods.updateAbout = function (about) {
  about = replaceBadWords(about)
  if (about.length > 1024) about = about.substr(0, 1024)
  this.about = about
}

ResourceSchema.methods.updateTitle = function (title) {
  let name = replaceBadWords(title).replace(/[\r\n]/g, '')
  if (name.length > 256) name = name.substr(0, 256)
  this.name = name
}

ResourceSchema.methods.uploadContent = function (buffer) {
  return new Promise((function (resolve, reject) {
    let where = this.data
    if (process.env.db_file_storage == "true") {
      var writestream = db.GridFS.createWriteStream({
        filename: where
      }, function (err, writestream) {
        if (err) {
          reject(err)
          return
        }
        writestream.on('error', function (err) {
          reject(err)
        })
        writestream.on('finish', function () {
          resolve()
        })
        writestream.write(buffer)
        writestream.end()
      })
    } else {
      fs.writeFile(where, buffer, function (err) {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    }
  }).bind(this))
}

ResourceSchema.methods.uploadThumbnail = function (thumb) {
  return new Promise((function (resolve, reject) {
    let where = this.data
    if (process.env.db_file_storage == "true") {
      db.GridFS.createWriteStream({
        filename: where + '.thumb'
      }, function (err, writestream) {
        if (err) {
          reject(err)
          return
        }
        writestream.write(thumb)
        writestream.end()
        resolve()
      })
    } else {
      fs.writeFile(where + '.thumb', thumb, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    }
  }).bind(this))
}

ResourceSchema.methods.getThumbnail = function () {
  let type = this.type === 'image/svg+xml'? 'image/svg+xml' : 'image/png'

  return new Promise((function (resolve, reject) {
    if (this.image || this.audio) {
      let location = this.data + '.thumb'
      if (location.startsWith('dbstorage/')) {
        db.GridFS.files.findOne({
          filename: location
        }, function (err, file) {
          if (err) {
            reject({
              'error': 'Resource not found'
            })
            return
          }
          db.GridFS.createReadStream({
            _id: file._id
          }, function (err, readstream) {
            if (err) {
              reject({
                'error': 'Unable to open database read stream'
              })
              return
            }
            var bufs = [];
            readstream.on('data', function (d) {
              bufs.push(d);
            });
            readstream.on('end', function () {
              var buf = Buffer.concat(bufs)

              resolve({
                contentType: type,
                data: buf
              })
            })
          })
        })
      } else {
        fs.readFile(location, (err, data) => {
          resolve({
            contentType: type,
            data: data
          })
        })
      }
    } else reject("Not supported")
  }).bind(this))
}

ResourceSchema.methods.incrementDownloads = async function (ip) {
  if (!this.downloaders.includes(ip)) {
    this.downloads = (this.downloads || 0) + 1
    this.downloaders.push(ip)
    await this.save()
  }
}

ResourceSchema.methods.downloadToResponse = function (req, res) {
  let location = this.data
  let type = this.type
  if (location.startsWith('dbstorage/')) {
    db.GridFS.files.findOne({
      filename: location
    }, function (err, file) {
      if (err) {
        res.status(404).render('404', {
          user: req.session.user
        })
        return
      }
      let rangeRequest = req.range(file.length)
      let rsParams = {
        _id: file._id
      }
      let length = file.length
      if (rangeRequest == -1 || rangeRequest == -2) {
        res.status(416)
        res.end()
        return
      }
      if (Array.isArray(rangeRequest) && rangeRequest.type === 'bytes' && rangeRequest.length > 0) {
        rsParams.range = {
          startPos: rangeRequest[0].start,
          endPos: rangeRequest[0].end
        }
        length = rsParams.range.endPos - rsParams.range.startPos + 1
        res.status(206)
        res.set('Content-Range', 'bytes ' + rsParams.range.startPos + '-' + rsParams.range.endPos + '/' + file.length)
      }

      db.GridFS.createReadStream(rsParams, function (err, readstream) {
        if (err) {
          res.status(500).json({
            'error': 'Unable to open database read stream'
          }).end()
          return
        }
        readstream.on('error', function (err) {
          res.status(500).json({
            'error': 'Database read stream failed',
            'errobj': err
          }).end()
        })
        res.contentType(type)
        res.set('Content-Length', length + '')
        res.set('Accept-Ranges', 'bytes')
        req.connection.on('close', (function (res, readstream) {
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

ResourceSchema.statics.findById = async function (id, whichFields) {
  let promise
  if (whichFields) {
    promise = Resource.findOne({
      _id: id
    }, whichFields)
  } else {
    promise = Resource.findOne({
      _id: id
    })
  }
  let result = await promise
  if (!result) throw "Resource not found"
  return result
}

Resource = mongoose.model('Resource', ResourceSchema)

module.exports = Resource