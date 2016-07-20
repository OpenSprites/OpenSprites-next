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
const ProjectBase = require('./ProjectBase')
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

async function prepare(options) {
  let zip = new NodeZip()
  
  let type = options.type
  
  let id = shortid() + (type == 'sprite' ? ".sprite2" : ".sb2")
  let fileName = dir + id
  let output = fs.createWriteStream(fileName)
  
  let seenCollections = []
  let seenResources = []
  
  let costumeMap = {}
  let soundMap = {}
  
  let scratchJson
  
  let costumeCounter = 0
  let soundCounter = 0
  
  if(type == 'sprite') {
    scratchJson = new SpriteBase()
    scratchJson.objName = "OpenSprites sprite"
  } else {
    scratchJson = new ProjectBase()
    costumeCounter++
    await $(zip, zip.entry, fs.createReadStream('public/assets/img/transparent-480x360.png'),
            { name: '0.png' })
  }
  
  let contributors = []
  
  async function addItem(scratchJson, item, contributors) {
    if (seenCollections.indexOf(item.item._id.toString()) > -1) return

    for (let owner of item.item.owners) {
      if (contributors.indexOf(owner) < 0) contributors.push(owner)
    }
    
    if (item.kind == 'Resource') {
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
      if (!item.item.script && seenResources.indexOf(item.item._id.toString()) > -1){
        if (item.item.image) {
          let costume = new Costume()
          costume.costumeName = item.item.name
          costume.baseLayerID = costumeMap[item.item._id.toString()]
          costume.baseLayerMD5 = '00000000000000000000000000000000.' + ext
          scratchJson.costumes.push(costume)
        } else if (item.item.audio) {
          let sound = new Sound()
          sound.soundName = item.item.name
          sound.soundID = soundMap[item.item._id.toString()].name
          sound.md5 = '00000000000000000000000000000000.wav'
          sound.rate = soundMap[item.item._id.toString()].rate
          sound.sampleCount = soundMap[item.item._id.toString()].sampleCount
          scratchJson.sounds.push(sound)
        }
      } else if (item.item.image) {
        name = costumeCounter
        costumeCounter++
        
        costumeMap[item.item._id.toString()] = name

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

        if(item.item.wavCache == "") {
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
          soundMap[item.item._id.toString()] = {name, sampleCount: sound.sampleCount, rate: sound.rate}
          
          readstream = fs.createReadStream(transcoded)
          
          let writestream = await $(db.GridFS, db.GridFS.createWriteStream, {
            filename: location + ".wav"
          })
          await new Promise(function(resolve, reject) {
            writestream.on('error', function (err) {
              reject(err)
            })
            writestream.on('finish', function () {
              resolve()
            })
            fs.createReadStream(transcoded).pipe(writestream)
          })
          
          let rsReup = await Resource.findById(item.item._id)
          rsReup.wavCache = location + ".wav"
          await rsReup.save()
        } else {
          let file = await $(db.GridFS.files, db.GridFS.files.findOne, {
            filename: location + ".wav"
          })

          let rsParams = {
            _id: file._id
          }
          let wavstream = await $(db.GridFS, db.GridFS.createReadStream, rsParams)
          
          let audioWrite = fs.createWriteStream(transcoded)

          await new Promise(function (resolve, reject) {
            wavstream.on('error', function (err) {
              console.log(err)
              reject(err)
            })
            wavstream.on('end', function () {
              audioWrite.end()
              resolve()
            })
            wavstream.pipe(audioWrite)
          })
          
          await new Promise(function(resolve, reject){
            sox.identify(transcoded, function(err, info) {
              if(err) {
                reject(err)
                return
              }
              sound.sampleCount = info.sampleCount
              sound.rate = info.sampleRate
              soundMap[item.item._id.toString()] = {name, sampleCount: info.sampleCount, rate: info.sampleRate}
              resolve()
            })
          })
          
          readstream = fs.createReadStream(transcoded)
        }
        
        scratchJson.sounds.push(sound)
      } else if (item.item.script) {
        // TODO: unsupported
        // do this :P
      }
      
      if (seenResources.indexOf(item.item._id.toString()) > -1){
        return // don't upload dups
      }
      
      seenResources.push(item.item._id.toString())

      await $(zip, zip.entry, readstream, {
        name: '' + name + '.' + ext
      })
    } else if (item.kind == 'Collection') {
      await addItems(scratchJson, await Collection.findOne({
        _id: item.item._id
      }))
    }
  }
  
  async function addItems(scratchJson, coll, ignoreTopLevel) {
    seenCollections.push(coll._id.toString())
    let items = (await coll.getItems()).items
    
    let localJson = scratchJson
    let localContrib = contributors || []
    if(scratchJson.objName == 'Stage' && !ignoreTopLevel) {
      localJson = new SpriteBase()
      localJson.objName = coll.name
      scratchJson.children.push(localJson)
      localContrib = []
      for(let owner of coll.owners){
        if(contributors.indexOf(owner) < 0) contributors.push(owner)
      }
    }
    
    for(let item of items){
      await addItem(localJson, item, localContrib)
    }
    
    if(scratchJson.objName == 'Stage' && !ignoreTopLevel) {
      localJson.scriptComments[0][6] = `Generated by OpenSprites (http://opensprites.org)

Make sure to give credit in the notes and credits!
---
This collection is located at: http://opensprites.org/collections/${coll._id}
Original name: ${coll.name}
By:
  ${coll.owners.join('\n  ')}
Contributors:
  ${localContrib.join('\n  ')}`
      if(localJson.costumes.length == 0){
        await fixCostumes(localJson)
      }
    }
  }
  
  async function fixCostumes(scratchJson){
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
    let extraComment = ''
    if(typeof options.which != 'string') {
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
        
        await addItem(scratchJson, {kind, item}, contributors)
      }
    } else {
      let coll = await Collection.findById(options.which)
      await addItems(scratchJson, coll, true)
      extraComment = `This collection is located at: http://opensprites.org/collections/${coll._id}
Original name: ${coll.name}
By:
  ${coll.owners.join('\n  ')}`
      scratchJson.objName = coll.name
    }
    
    if(scratchJson.costumes.length == 0){
      await fixCostumes(scratchJson)
    }
    
    scratchJson.scriptComments[0][6] = `Generated by OpenSprites (http://opensprites.org)

Make sure to give credit in the notes and credits!
---
${extraComment}
Contributors:
  ${contributors.join('\n  ')}

`
    await $(zip, zip.entry, JSON.stringify(scratchJson), { name: (type == 'sprite' ? 'sprite.json' : 'project.json') })   
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