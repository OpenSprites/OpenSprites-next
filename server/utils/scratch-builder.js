var CronJob = require('cron').CronJob;
const fs = require('fs')
const NodeZip = require('zip-stream')
const shortid = require('shortid')
// node doesn't double-load so we can require these in a file other than main
const Resource = require('../models/Resource')
const Collection = require('../models/Collection')
const db = require('../db')
const $ = require('./callback-to-promise.js')

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
  
  let id = shortid() + ".sprite2"
  let fileName = dir + id
  let output = fs.createWriteStream(fileName)
  
  let seenCollections = []
  let seenResources = []
  
  async function addItems(coll) {
    seenCollections.push(coll._id)
    let items = (await coll.getItems()).items
    for(let item of items){
      if(seenCollections.indexOf(item.item._id) > -1) continue
      if(seenResources.indexOf(item.item._id) > -1) continue
      
      if(item.kind == 'Resource') {
        seenResources.push(item.item._id)
        let location = item.item.data
        
        let file = await $(db.GridFS.files, db.GridFS.files.findOne, {filename: location})
        
        let rsParams = {
          _id: file._id
        }
        let readstream = await $(db.GridFS, db.GridFS.createReadStream, rsParams)
        
        let ext = item.item.type.split('/')[1]
        if(ext == 'svg+xml') ext = 'svg'
        if(ext == 'jpeg') ext = 'jpg'
        
        await $(zip, zip.entry, readstream, { name: item.item.name + '.' + ext })
      } else if(item.kind == 'Collection') {
        await addItems(await Collection.findOne({_id: item.item._id}))
      }
    }
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
    await addItems(coll)
    zip.finish()
    
    await promise
    
    return id
  } catch(e) {
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