var CronJob = require('cron').CronJob;
const fs = require('fs')
const NodeZip = require('zip-stream')
const shortid = require('shortid')
const sox = require('./sox')

// node doesn't double-load so we can require these in a file other than main
const Resource = require('../models/Resource')
const Collection = require('../models/Collection')
const db = require('../db')
const $ = require('./callback-to-promise.js')

const SpriteBase = require('./SpriteBase')
const Costume = require('./Costume')
const Sound = require('./Sound')

const dir = 'scratch-builder-files/'

let job

async function clean() {
  let files = await $(fs, fs.readdir, dir)
  for(let file of files) {
    let stat = await $(fs, fs.stat, dir + file)
    if(stat.mtime.getTime() < new Date().getTime() - 24 * 3600 * 1000) {
      fs.unlink(dir + file)
    }
  }
}

function init() {
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  } else {
    clean()
  }
  
  job = new CronJob('0 0 0 * * *', clean, null, true, 'America/New_York');
}

async function prepare(coll, options) {
  let zip = new NodeZip()
  
  let type = options.type
  
  let id = shortid() + ".sprite2"
  let fileName = dir + id
  let output = fs.createWriteStream(fileName)
  
  let seenCollections = []
  let seenResources = []
  
  let scratchJson = new SpriteBase()
  scratchJson.objName = coll.name
  
  let contributors = coll.owners.slice()

  let costumeCounter = 0
  let soundCounter = 0
  
  async function addItem(item) {
    if (seenCollections.indexOf(item.item._id.toString()) > -1) return
    if (seenResources.indexOf(item.item._id.toString()) > -1) return

    for (let owner of item.item.owners) {
      if (contributors.indexOf(owner) < 0) contributors.push(owner)
    }
    
    if (item.kind == 'Resource') {
      seenResources.push(item.item._id.toString())
      let location = item.item.data

      let file = await $(db.GridFS.files, db.GridFS.files.findOne, {
        filename: location
      })

      let rsParams = {
        _id: file._id
      }
      let readstream = await $(db.GridFS, db.GridFS.createReadStream, rsParams)

      let ext = item.item.type.split('/')[1]
      if (ext == 'svg+xml') ext = 'svg'
      if (ext == 'jpeg') ext = 'jpg'

      let name = Math.floor(Math.random() * 10000) + 100
      if (item.item.image) {
        name = costumeCounter
        costumeCounter++

        let costume = new Costume()
        costume.costumeName = item.item.name
        costume.baseLayerID = name
        // scratch doesn't care about the md5 it seems
        // but we need the extension there
        // it's kind of a roundabout way of storing the extension
        costume.baseLayerMD5 = '00000000000000000000000000000000.' + ext
        scratchJson.costumes.push(costume)
      } else if (item.item.audio) {
        name = soundCounter
        soundCounter++

        let sound = new Sound()
        sound.soundName = item.item.name
        sound.soundID = name
        sound.md5 = '00000000000000000000000000000000.wav'

        let orig = dir + shortid() + "." + ext
        ext = 'wav'
        let transcoded = dir + shortid() + ".wav"

        let audioWrite = fs.createWriteStream(orig)

        await new Promise(function (resolve, reject) {
          readstream.on('error', function (err) {
            console.log(err)
            reject(err)
          })
          readstream.on('end', function () {
            audioWrite.end()
            resolve()
          })
          readstream.pipe(audioWrite)
        })

        await new Promise(function (resolve, reject) {
          var job = sox.transcode(orig, transcoded, {
            format: 'wav',
            channelCount: 1,
            sampleRate: 22050
          })
          job.on('error', function (err) {
            console.error(err)
            reject(err)
          });
          job.on('dest', function (info) {
            sound.sampleCount = info.sampleCount
            sound.rate = info.sampleRate
          })
          job.on('end', function () {
            resolve()
          })
          job.start()
        })

        readstream = fs.createReadStream(transcoded)
        scratchJson.sounds.push(sound)

      } else if (item.item.script) {
        // TODO: unsupported
        // do this :P
      }

      await $(zip, zip.entry, readstream, {
        name: '' + name + '.' + ext
      })
    } else if (item.kind == 'Collection') {
      await addItems(await Collection.findOne({
        _id: item.item._id
      }))
    }
  }
  
  async function addItems(coll) {
    seenCollections.push(coll._id.toString())
    let items = (await coll.getItems()).items
    for(let item of items){
      await addItem(item)
    }
  }
  
  async function fixCostumes(){
    // Scratch refuses to recognize that the sprite exists if there
    // are 0 costumes...time for a shameless plug! :P
    let costume = new Costume()
    costume.costumeName = 'OpenSprites'
    costume.baseLayerID = costumeCounter
    costume.baseLayerMD5 = '00000000000000000000000000000000.svg'
    scratchJson.costumes.push(costume)
    
    await $(zip, zip.entry, fs.createReadStream('public/assets/img/logo/filled.svg'),
            { name: '' + costumeCounter + '.svg' })
  }
  
  zip.pipe(output)
  let promise = new Promise(function(resolve, reject){
    zip.on('end', function(){
      output.end()
      resolve()
    })
    zip.on('error', function(err){
      console.log(err)
      output.end()
      reject(err)
    })
  })
  
  try {
    if(options.which != 'all') {
      for(let id of options.which){
        let item
        let kind
        try {
          item = await Resource.findById(id)
          kind = 'Resource'
        } catch(e){
          try {
            item = await Collection.findById(id)
            kind = 'Collection'
          } catch(e){
            continue
          }
        }
        
        await addItem({kind, item})
      }
    } else {
      await addItems(coll)
    }
    
    if(costumeCounter == 0){
      await fixCostumes()
    }
    
    scratchJson.scriptComments[0][6] = `Generated by OpenSprites (http://opensprites.org)

Make sure to give credit in the notes and credits!
---
This collection is located at: http://opensprites.org/collections/${coll._id}
Original name: ${coll.name}
Contributors:
  ${contributors.join('\n  ')}

`
    await $(zip, zip.entry, JSON.stringify(scratchJson), { name: 'sprite.json' })   
    zip.finish()
    
    await promise
    
    return id
  } catch(e) {
    console.log(e)
    output.end()
    fs.unlink(fileName)
    throw e
  }
}

async function download(id, name, req, res) {
  let fileName = dir + id

  let length
  try {
    var stats = fs.statSync(fileName)
    length = stats["size"]
  } catch (e) {
    console.log(e)
    res.status(404).render('404', {
      user: req.session.user
    })
    return
  }

  let rangeRequest = req.range(length)
  let rsParams = {}
  if (rangeRequest == -1 || rangeRequest == -2) {
    res.status(416)
    res.end()
    return
  }
  if (Array.isArray(rangeRequest) && rangeRequest.type === 'bytes' && rangeRequest.length > 0) {
    rsParams = {
      start: rangeRequest[0].start,
      end: rangeRequest[0].end
    }
    length = rsParams.end - rsParams.start + 1
    res.status(206)
    res.set('Content-Range', 'bytes ' + rsParams.start + '-' + rsParams.end + '/' + length)
  }

  let readstream = fs.createReadStream(fileName, rsParams)

  readstream.on('error', function(err) {
    console.log(err)
    res.status(500).render('500', {user: req.session.user})
  })
  res.contentType('application/zip')
  res.set('Content-Length', length + '')
  res.set('Content-Disposition', 'attachment; filename="' + name + '.' + id.split(".")[1] + '"')
  res.set('Accept-Ranges', 'bytes')
  req.connection.on('close', (function(res, readstream) {
    readstream.unpipe()
    res.end()
  }).bind(this, res, readstream));
  readstream.pipe(res)
}

module.exports = {
  init,
  download,
  prepare,
  job
}