/**
 * js/share.js
 * -----------
 * 
 * Black magic for the Share page.
 */

const ajax = require('axios')
const template = require('./template')
const resources = require('./resources')
const cookie = require('cookie')
const shortid = require('shortid')
const jszip = require('jszip')

const allowedMedia = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mp3',
  '.wav': 'audio/wav'
}

async function decomposeProjectFile(file) {
  let zip = await jszip.loadAsync(file)
  console.log(zip)
  
  let content = {}
  let jsonEntry = null
  zip.forEach(function(relativePath, zipEntry) {
    if(zipEntry.dir) return
    
    if(zipEntry.name.toLowerCase().endsWith('.json')) {
      jsonEntry = zipEntry
    }
  })
  
  if(jsonEntry) {
    content = JSON.parse(await jsonEntry.async('string'))
    let scripts = parseContentForScripts(content)
    for(let script of scripts) {
      let thingy = new Blob([JSON.stringify(script)], {
        type: 'application/json'
      })
      thingy.name = `New Script ${shortid()}.json`
      
      initResourceInput(addResourceInput(), thingy, script)
    }
  }
  
  function lookupName(filename, type) {
    let id = parseInt(filename.split('.')[0])
    let arrayKey = type.startsWith('audio') ? 'sounds' : 'costumes'
    let idKey = type.startsWith('audio') ? 'soundID' : 'baseLayerID'
    let nameKey = type.startsWith('audio') ? 'soundName' : 'costumeName'
    
    if(content.hasOwnProperty('penLayerID') && parseInt(content.penLayerID) == id && type.startsWith('image')) {
      return 'Pen Layer'
    }
    
    function doSearch(item) {
      for(let arrItem of (item[arrayKey] || [])) {
        if(parseInt(arrItem[idKey]) == id) {
          return arrItem[nameKey]
        }
      }
      for(let child of (item.children || [])) {
        let res = doSearch(child)
        if(res) { return res }
      }
      return null
    }
    
    let res = doSearch(content)
    if(res) {
      return res
    } else {
      return "Unnamed Item"
    }
  }
  
  zip.forEach(async function(relativePath, zipEntry) {
    if (zipEntry.dir) return

    let isMedia = false
    let type = null
    for (let ext in allowedMedia) {
      if (zipEntry.name.toLowerCase().endsWith(ext)) {
        isMedia = true
        type = allowedMedia[ext]
        break
      }
    }
    if (isMedia) {
      let arrayBuffer = await zipEntry.async('arraybuffer')
      let thingy = new Blob([arrayBuffer], {
        type
      })
      thingy.name = lookupName(zipEntry.name, type) + '.ext'
      
      initResourceInput(addResourceInput(), thingy)
    }
  })
}

function parseContentForScripts(content) {
  function doParse(content, scripts) {
    for(let script of (content.scripts || [])) {
      scripts.push(script[2])
    }
    for(let child of (content.children || [])) {
      doParse(child, scripts)
    }
    return scripts
  }
  
  return doParse(content, [])
}

function initResourceInput(dialog, file, content) {
  dialog.classList.add('has-file')
  dialog._attachmentFile = file

  let name = file.name.split('.')
  if(name.length > 1) name.pop()
  name = name.join(' ')

  dialog.querySelector('.file-upload-name').value = name
  dialog.dataset.id = shortid.generate()

  const audio = file.type.substr(0, 5) === 'audio'
  const image = file.type.substr(0, 5) === 'image'
  const script = file.type == 'application/json'

  const data = URL.createObjectURL(file)

  if (audio) {
    dialog.querySelector('.file-type').innerText = 'Sound'
    dialog.querySelector('.img').style.backgroundImage = `url("/${window.resources}/${name}/cover-inb4")`

    dialog.querySelector('.img').classList.add('audio')
    dialog.querySelector('.img audio').src = data

    // add events
    resources.parse()
  }

  if (image) {
    dialog.querySelector('.file-type').innerText = 'Costume'
    dialog.querySelector('.img img').src = data
  }
  
  if(script) {
    var scriptDoc = new scratchblocks.Document(scratchblocks.fromJSON({scripts: [[0,0,content]]}).scripts);
    scriptDoc.render(function(svg) {
      dialog.querySelector('.img').appendChild(svg)
    })
  }
}

function addResourceInput() {
  const dialog = template('file-upload')
  const fileInput = dialog.querySelector('input[type=file]')
  fileInput.addEventListener('change', async function(e) {
    const file = fileInput.files[0]
    if(file.name.endsWith('.zip') ||
      file.name.endsWith('.sb2') ||
      file.name.endsWith('.sprite2')){
      decomposeProjectFile(file)
      return
    }

    initResourceInput(dialog, file)    
  })
  document.getElementById('file-uploads').appendChild(dialog)

  dialog.querySelector('.file-select-text')
        .addEventListener('click', e => fileInput.click())
  dialog.querySelector('.remove')
        .addEventListener('click', dialog.remove.bind(dialog))
  
  return dialog
}

async function upload() {
  const resources = document.querySelectorAll('#file-uploads .resource:not(.done)')
  let req = []

  for(let r = 0; r < resources.length; r++) {
    let resource = resources[r]
    const file = resource._attachmentFile
    if(!file) continue

    resource.style.pointerEvents = 'none'
    resource.querySelector('.overlay').style.display = 'block'

    let data = new FormData()
    data.append('name', resource.querySelector('.file-upload-name').value)
    data.append('file', file)
    data.append('clientid', resource.dataset.id)

    req.push(ajax.put('/share', data, {
      'headers': {
        'X-CSRF-Token': window.csrf
      },
      
      progress: p => {
        let percent = Math.floor((p.loaded / p.total) * 100)
        resource.querySelector('.progress-text').innerText = (percent == 100 ? 'Processing' : percent + '%')
        
        let paths = resource.querySelectorAll('svg.progress path');
        
        let percent1 = Math.min(percent, 50)
        let pathDef1 = "M55,5 a50,50 0 0,1 "
        pathDef1 += (50 * Math.cos(Math.PI / 2 - percent1 * Math.PI / 50))
        pathDef1 += ","
        pathDef1 += (50 - 50 * Math.sin(Math.PI / 2 - percent1 * Math.PI / 50))
        paths[0].setAttribute("d", pathDef1)
        
        let percent2 = Math.max(percent - 50, 0)
        if(percent2 > 0) {
          percent2 = 50 - percent2
          let pathDef2 = "M55,105 a50,50 0 0,1 "
          pathDef2 += (-50 * Math.cos(Math.PI / 2 - percent2 * Math.PI / 50))
          pathDef2 += ","
          pathDef2 += (-50 - 50 * Math.sin(Math.PI / 2 - percent2 * Math.PI / 50))
          paths[1].setAttribute("d", pathDef2)
        } else {
          paths[1].setAttribute("d", "M55,105 a50,50 0 0,1 0,0")
        }
      }
    }))
  }
  
  if(req.length == 0)
    return
  
  document.querySelector('a#submit').style.display = 'none'
  document.querySelector('a#add-resource').style.display = 'none'
  document.querySelector('.upload-error').style.display = 'none'
  
  ajax.all(req).then(function(res) {
    console.log(res)
    if(Array.isArray(res)){
      for(let item of res){
        let resource = document.querySelector("[data-id=" + item.data.clientid + "]")
        if(item.data.success){
          resource.classList.add('done')
          resource.dataset.osurl = item.data.osurl
        }
      }
    }
    
    completeUpload()
  }, function(res){
    document.querySelector('.upload-error').style.display = 'block'
    if(res.data && res.data.message){
      document.querySelector('.upload-error .details').textContent = JSON.stringify(res.data.message)
    }
    completeUpload()
  })
}

function completeUpload() {
  document.querySelector('a#submit').style.display = 'inline-block'
  document.querySelector('a#add-resource').style.display = 'inline-block'
  Array.from(document.querySelectorAll("#file-uploads .resource:not(.done)")).forEach(item =>
    item.querySelector(".overlay").style.display = "none"
  );
  
  Array.from(document.querySelectorAll("#file-uploads .resource.done")).forEach(item => {
    item.style.pointerEvents = 'all'
    let text = item.querySelector('.progress-text')
    text.innerHTML = ''
    let link = document.createElement('a')
    link.href = item.dataset.osurl
    link.target = '_blank'
    link.textContent = 'Open'
    text.appendChild(link)
  });
}

module.exports = function() {
  addResourceInput()

  document.getElementById('add-resource')
    .addEventListener('click', addResourceInput)

  document.querySelector('#submit')
    .addEventListener('click', upload)
    
  document.addEventListener('dragover', function(e){
    e.dataTransfer.dropEffect = 'copy'
    e.preventDefault()
    document.querySelector('#file-uploads').classList.add('drag')
  })
  document.addEventListener('dragend', function(){
    document.querySelector('#file-uploads').classList.remove('drag')
  })
  document.addEventListener('drop', function(e){
    document.querySelector('#file-uploads').classList.remove('drag')
    let files = e.dataTransfer.files
    for(let file of files) {
      if(file.name.endsWith('.zip') ||
          file.name.endsWith('.sb2') ||
          file.name.endsWith('.sprite2')){
        decomposeProjectFile(file)
      } else {
        initResourceInput(addResourceInput(), file)
      }
    }
    e.preventDefault()
  })
}
