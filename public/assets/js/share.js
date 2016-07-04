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

function addResourceInput() {
  const dialog = template('file-upload')
  const fileInput = dialog.querySelector('input[type=file]')
  fileInput.addEventListener('change', async function(e) {
    dialog.classList.add('has-file')
    const file = fileInput.files[0]

    let name = file.name.split('.')
        name.pop()
        name = name.join(' ')

    dialog.querySelector('.file-upload-name').value = name
    dialog.dataset.id = shortid.generate()

    const audio = file.type.substr(0, 5) === 'audio'
    const image = file.type.substr(0, 5) === 'image'

    const data = URL.createObjectURL(file)

    if(audio) {
      dialog.querySelector('.file-type').innerText = 'Sound'
      dialog.querySelector('.img').style.backgroundImage = `url("/${window.resources}/${name}/cover-inb4")`

      dialog.querySelector('.img').classList.add('audio')
      dialog.querySelector('.img audio').src = data

      // add events
      resources.parse()
    }

    if(image) {
      dialog.querySelector('.file-type').innerText = 'Costume'
      dialog.querySelector('.img img').src = data
    }
  })
  document.getElementById('file-uploads').appendChild(dialog)

  dialog.querySelector('.file-select-text')
        .addEventListener('click', e => fileInput.click())
  dialog.querySelector('.remove')
        .addEventListener('click', dialog.remove.bind(dialog))
}

async function upload() {
  const resources = document.querySelectorAll('#file-uploads .resource:not(.done)')
  let req = []

  for(let r = 0; r < resources.length; r++) {
    let resource = resources[r]
    const file = resource.querySelector('input[type=file]').files[0]
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
}
