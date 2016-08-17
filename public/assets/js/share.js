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
  '.png':  'image/png',
  '.jpg':  'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.mp3':  'audio/mp3',
  '.wav':  'audio/wav',
  '.json': 'application/json'
}

async function fetchScratchResource(md5) {
  let res = await ajax.get('https://cdn.assets.scratch.mit.edu/internalapi/asset/'+ md5 + '/get/', { responseType: 'blob' })
  return res.data
}

function insertResourceFromScratch(name, ext, blob) {
  if(!allowedMedia.hasOwnProperty(ext)) {
    console.warn('No mime type detected for ', name, ext)
    return
  }
  blob = new Blob([blob], {type: allowedMedia[ext]})
  blob.name = name
  initResourceInput(addResourceInput(), blob)
}

async function parseScratchProjectNode(content, seenResources) {
  if(!seenResources) seenResources = []
  
  if(content.hasOwnProperty('penLayerMD5')) {
    try {
      let penLayerBlob = await fetchScratchResource(content.penLayerMD5)
      insertResourceFromScratch('Pen Layer', '.' + content.penLayerMD5.split('.')[1], penLayerBlob)
    } catch(e) {
      console.log(e)
    }
  }
  
  for(let costume of (content.costumes || [])) {
    if(seenResources.indexOf(costume.baseLayerMD5) > -1) continue
    seenResources.push(costume.baseLayerMD5)
    try {
      let costumeBlob = await fetchScratchResource(costume.baseLayerMD5)
      insertResourceFromScratch(costume.costumeName, '.' + costume.baseLayerMD5.split('.')[1], costumeBlob)
    } catch(e) {
      console.log(e)
    }
  }
  
  for(let sound of (content.sounds || [])) {
    if(seenResources.indexOf(sound.md5) > -1) continue
    seenResources.push(sound.md5)
    try {
      let soundBlob = await fetchScratchResource(sound.md5)
      insertResourceFromScratch(sound.soundName, '.' + sound.md5.split('.')[1], soundBlob)
    } catch(e) {
      console.log(e)
    }
  }
  
  for(let script of (content.scripts || [])) {
    script = script[2]
    let thingy = new Blob([JSON.stringify(script)], {
      type: 'application/json'
    })
    thingy.name = `New Script ${shortid()}.json`
    initResourceInput(addResourceInput(), thingy, script)
  }
  
  for(let child of (content.children || [])) {
    await parseScratchProjectNode(child, seenResources)
  }
}

async function addScratchProject(url) {
  let parser = document.createElement('a')
  parser.href = url
  if(!parser.hostname.endsWith('scratch.mit.edu')) return
  let path = parser.pathname
  let match = path.match(/projects\/(\d+)/)
  if(!match || match.length < 2) return
  let id = match[1]
  
  document.querySelector('#scratch-url-btn').disabled = true
  document.querySelector('#scratch-url-container').classList.add('working')
  
  try {
    let scratchJson = (await ajax.get('https://cdn.projects.scratch.mit.edu/internalapi/project/' + id + '/get/')).data
    console.log(scratchJson)
    
    await parseScratchProjectNode(scratchJson)
    
    document.querySelector('#scratch-url').value = ''
  } catch(e){
    console.log(e)
  }
  document.querySelector('#scratch-url-btn').disabled = false
  document.querySelector('#scratch-url-container').classList.remove('working')
  
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
      return filename
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
    dialog.querySelector('.file-type').innerText = 'Script'
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

  let toProcess = []
  let totalSize = 0
  let uploadedSize = 0
  for(let r = 0; r < resources.length; r++) {
    let resource = resources[r]
    const file = resource._attachmentFile
    if(!file) continue
    
    totalSize += file.size

    resource.style.pointerEvents = 'none'
    resource.querySelector('.overlay').style.display = 'block'
    toProcess.push(resource)
  }
  
  console.log("Total size to upload: " + totalSize)
  
  if(toProcess.length == 0) return
  
  toProcess.reverse()

  document.querySelector('a#submit').style.display = 'none'
  document.querySelector('a#add-resource').style.display = 'none'
  document.querySelector('.upload-error').style.display = 'none'

  // browserify with es6ify really doesn't like awaits in loops
  // idk why
  async function processNext() {
    let resource = toProcess.pop()
    const file = resource._attachmentFile

    resource.style.pointerEvents = 'none'
    resource.querySelector('.overlay').style.display = 'block'

    let data = new FormData()
    data.append('name', resource.querySelector('.file-upload-name').value)
    data.append('file', file)
    data.append('clientid', resource.dataset.id)
    let thisFileSize = file.size

    try {
      let req = ajax.put('/share', data, {
        'headers': {
          'X-CSRF-Token': window.csrf
        },

        progress: p => {
          let percent = Math.floor((p.loaded / p.total) * 100)
          
          document.querySelector('.share-progress').textContent = ' (Sharing ' + Math.floor(100 * (uploadedSize + ((p.loaded / p.total) * thisFileSize)) / totalSize) + '%)'
          resource.querySelector('.progress-text').innerText = (percent == 100 ? 'Processing' : percent + '%')

          let paths = resource.querySelectorAll('svg.progress path');

          let percent1 = Math.min(percent, 50)
          let pathDef1 = "M55,5 a50,50 0 0,1 "
          pathDef1 += (50 * Math.cos(Math.PI / 2 - percent1 * Math.PI / 50))
          pathDef1 += ","
          pathDef1 += (50 - 50 * Math.sin(Math.PI / 2 - percent1 * Math.PI / 50))
          paths[0].setAttribute("d", pathDef1)

          let percent2 = Math.max(percent - 50, 0)
          if (percent2 > 0) {
            percent2 = 50 - percent2
            let pathDef2 = "M55,105 a50,50 0 0,1 "
            pathDef2 += (-50 * Math.cos(Math.PI / 2 - percent2 * Math.PI / 50))
            pathDef2 += ","
            pathDef2 += (-50 - 50 * Math.sin(Math.PI / 2 - percent2 * Math.PI / 50))
            paths[1].setAttribute("d", pathDef2)
          }
          else {
            paths[1].setAttribute("d", "M55,105 a50,50 0 0,1 0,0")
          }
        }
      })
      
      let res = await req
      
      uploadedSize += thisFileSize

      let resourceDom = document.querySelector("[data-id=" + res.data.clientid + "]")
      if (res.data.success) {
        resourceDom.classList.add('done')
        resourceDom.dataset.osurl = res.data.osurl
        updateLink(resourceDom)
      } else {
        throw res.data
      }
    } catch (e) {
      console.log(e)
      document.querySelector('.upload-error').style.display = 'block'
    }
    if(toProcess.length > 0) await processNext()
  }
  
  await processNext()
  
  document.querySelector('a#submit').style.display = 'inline-block'
  document.querySelector('a#add-resource').style.display = 'inline-block'
  Array.from(document.querySelectorAll("#file-uploads .resource:not(.done)")).forEach(item =>
    item.querySelector(".overlay").style.display = "none"
  );
  
  document.querySelector('.share-progress').textContent = ''
}

function updateLink(item) {
  item.style.pointerEvents = 'all'
  let text = item.querySelector('.progress-text')
  text.innerHTML = ''
  let link = document.createElement('a')
  link.href = item.dataset.osurl
  link.target = '_blank'
  link.textContent = 'Open'
  text.appendChild(link)
}

module.exports = function() {
  addResourceInput()

  document.getElementById('add-resource')
    .addEventListener('click', addResourceInput)

  document.querySelector('#submit')
    .addEventListener('click', upload)
    
  document.querySelector('#scratch-url-btn').addEventListener('click', function(){
    addScratchProject(document.querySelector('#scratch-url').value)
  })
    
  document.addEventListener('dragover', function(e){
    e.dataTransfer.dropEffect = 'copy'
    e.preventDefault()
    document.querySelector('#file-uploads').classList.add('drag')
  })
  document.addEventListener('dragleave', function(){
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
