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
}

async function upload() {
  document.querySelector('a#submit').style.display = 'none'
  document.querySelector('a#add-resource').style.display = 'none'

  const resources = document.querySelectorAll('#file-uploads .resource')
  let req = []

  for(let r = 0; r < resources.length; r++) {
    let resource = resources[r]
    const file = resource.querySelector('input[type=file]').files[0]

    resource.style.pointerEvents = 'none'
    resource.querySelector('.file-type').innerText = '0% uploaded'

    let data = new FormData()
    data.append('name', resource.querySelector('.file-upload-name').value)
    data.append('file', file)

    req.push(ajax.put('/share', data, {
      'headers': {
        'X-CSRF-Token': window.csrf
      },
      
      progress: p => {
        let percent = Math.floor((p.loaded / p.total) * 100)
        resource.querySelector('.file-type').innerText = percent + '% uploaded'
      }
    }))
  }

  ajax.all(req).then(ajax.spread(function() {
    window.location.href = '/you'
  }))
}

module.exports = function() {
  addResourceInput()

  document.getElementById('add-resource')
    .addEventListener('click', addResourceInput)

  document.querySelector('#submit')
    .addEventListener('click', upload)
}
