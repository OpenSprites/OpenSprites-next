const ajax = require('axios')

let addBtn, removeBtn

function updateView(){
  let hash = location.hash
  if(hash.startsWith('#')) hash = hash.substring(1)
  
  if(hash == 'collection-settings'){
    updateCollectionSettings()
  }
  
  if(hash == 'collection-remove' && (!OS.toRemoveIds || OS.toRemoveIds.length == 0)) {
    location.hash = '#_'
  }
  
  // update resource item handlers
  Array.from(document.querySelectorAll(".resource-select")).forEach(function(check) {
    check.onchange = function() {
      let anyChecked = !!document.querySelector(".resource-select:checked")
      removeBtn.disabled = !anyChecked
    }
  })
}

async function reloadResources() {
  let res = await ajax.get(location.pathname + '/items', {})
  document.querySelector(".resources").innerHTML = res.data
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

function removeConfirm() {
  OS.toRemoveIds = []
  
  let list = document.querySelector(".collection-ui .collection-remove-list")
  list.innerHTML = ''
  
  for(let check of Array.from(document.querySelectorAll(".resource-select:checked"))) {
    let id = check.parentElement.id;
    let name = check.parentElement.querySelector(".resource-name").textContent
    
    let li = document.createElement("li")
    li.textContent = name
    list.appendChild(li)
    
    OS.toRemoveIds.push(id)
  }
  
  location.hash = '#collection-remove'
}

async function doRemove() {
  let status = document.querySelector(".collection-ui.dialog-remove small.status")
  let button = document.querySelector(".collection-ui.dialog-remove .confirm")
  let cancel = document.querySelector(".collection-ui.dialog-remove .btn.flat")
  
  button.disabled = true
  cancel.disabled = true
  status.textContent = "Removing..."
  
  try {
    // delete doesn't like csrf for some reason
    await ajax.post(location.pathname + '/items/delete', {
        ids: OS.toRemoveIds,
        csrf: window.csrf
      }, {
        'headers': {
          'X-CSRF-Token': window.csrf
        }
    })
    status.textContent = ""
    location.hash = '#_'
    
    reloadResources()
    
    OS.toRemoveIds = []
  } catch(e){
    console.log(e)
    status.textContent = "Error"
  }
  
  button.disabled = false
  cancel.disabled = false
}

async function addToCollection(rawItem){
  let item = null
  
  if(rawItem.startsWith("http")) {
    item = rawItem.match(/[a-f0-9]{24}/gi)
    if(!item) return
    item = item[0]
  } else if(rawItem.match(/^[a-f0-9]{24}$/gi)) {
    item = rawItem
  } else {
    return
  }
  
  let btn = document.querySelector(".collection-ui .add-by-url .submit")
  btn.disabled = true
  try {
    let res = await ajax.put(location.pathname + '/items', {
        ids: [item]
      }, {
        'headers': {
          'X-CSRF-Token': window.csrf
        }
    })
    if(!res.data || !res.data.length) {
      pAlert("Uh oh! We couldn't add that item")
      btn.disabled = false
      return
    }
    
    reloadResources()
  } catch(e){
    console.log(e)
    pAlert("Error: " + e)
  }
  btn.disabled = false
}

function pAlert(msg) {
  return new Promise(function(resolve){
    document.querySelector(".collection-ui.dialog-alert .alert-content").textContent = msg
    document.querySelector(".collection-ui.dialog-alert .btn").onclick = function(){
      location.hash = "#_"
      resolve()
    }
    location.hash = '#collection-alert'
  })
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
  
  addBtn = document.querySelector('.collection-ui.controls .add-btn')
  if(addBtn) {
    addBtn.addEventListener('click', function(){
      document.querySelector(".collection-ui .add-by-url").classList.toggle("active")
    })
    document.querySelector(".collection-ui .add-by-url .submit").addEventListener('click', function(){
      addToCollection(document.querySelector(".collection-ui .add-by-url input").value)
    })
  }
  
  let settingsBtn = document.querySelector('.collection-ui.controls .settings-btn')
  if(settingsBtn) settingsBtn.addEventListener('click', function(){
    location.hash = "#collection-settings"
  })
  
  removeBtn = document.querySelector('.collection-ui.controls .remove-btn')

  if (removeBtn) {
    removeBtn.addEventListener('click', function() {
      removeConfirm()
    })

    document.querySelector(".collection-ui.dialog-remove .confirm").addEventListener('click', function() {
      doRemove();
    })
    document.querySelector(".collection-ui.dialog-remove .btn.flat").addEventListener('click', function() {
      location.hash = '#_'
    })
  }
}