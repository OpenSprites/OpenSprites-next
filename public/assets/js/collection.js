const ajax = require('axios')

function updateView(){
  let hash = location.hash
  if(hash.startsWith('#')) hash = hash.substring(1)
  
  if(hash == 'collection-settings'){
    updateCollectionSettings()
  }
}

async function saveCollectionSettings(){
  for(let permission in OS.collectionPermissions.everyone) {
    let val = document.querySelector(`input[name=${permission}]:checked`).value
    OS.collectionPermissions.everyone[permission] = false
    OS.collectionPermissions.curators[permission] = false
    
    if(val == 'everyone' || val == 'curators'){
      OS.collectionPermissions[val][permission] = true
    }
  }
  
  let saveButton = document.querySelector(".permissions-save")
  saveButton.disabled = true
  saveButton.textContent = "Saving..."
  let status = document.querySelector(".permissions-status")
  status.textContent = ''
  
  try {
    await ajax.put(location.pathname + '/permissions', {
        permissions: OS.collectionPermissions
      }, {
        'headers': {
          'X-CSRF-Token': window.csrf
        }
    })
    saveButton.disabled = false
    saveButton.textContent = "Save"
    status.textContent = "Saved"
  } catch(e){
    console.log(e)
    saveButton.disabled = false
    saveButton.textContent = "Save"
    status.textContent = "Error"
  }
}

function updateCollectionSettings(){
  for(let permission in OS.collectionPermissions.everyone){ 
    if(OS.collectionPermissions.everyone[permission]) {
      document.querySelector(`input[name=${permission}][value=everyone]`).checked = true
    } else if(OS.collectionPermissions.curators[permission]) {
      document.querySelector(`input[name=${permission}][value=curators]`).checked = true
    } else {
      document.querySelector(`input[name=${permission}][value=owners]`).checked = true
    }
  }
  
  document.querySelector(".permissions-save").onclick = saveCollectionSettings
}


module.exports = function() {
  window.addEventListener('hashchange', function(){
    updateView()
  })
  
  updateView()
  
  // event handlers for buttons
  document.querySelector('.collection-ui.controls .display-switch').addEventListener('click', function(){
    let container = document.querySelector('.resource-container')
    if(container.classList.contains('display-tiles')) {
      container.classList.remove('display-tiles')
      container.classList.add('display-list')
      document.querySelector('.collection-ui.controls .display-switch').textContent = 'view_module'
    } else {
      container.classList.remove('display-list')
      container.classList.add('display-tiles')
      document.querySelector('.collection-ui.controls .display-switch').textContent = 'view_list'
    }
  })
  
  let settingsBtn = document.querySelector('.collection-ui.controls .settings-btn')
  if(settingsBtn) settingsBtn.addEventListener('click', function(){
      location.hash = "#collection-settings"
    })
}