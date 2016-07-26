const AudioThumb = require('./audio-thumb')
const ajax = require('axios')
const htmldec = require('htmldec')

let timeoutId

module.exports = function(){
  let atElem = document.querySelector('.audio-thumb')
  if(atElem) {
    AudioThumb(location.pathname.substring(location.pathname.lastIndexOf('/') + 1), function(dataurl){
      document.querySelector(".audio-thumb-container").classList.add("fade-out")
      setTimeout(function(){
        atElem.src = dataurl
        document.querySelector(".audio-thumb-container .loader").style.display = "none"
        document.querySelector(".audio-thumb-container").classList.remove("fade-out")
      }, 200)
    })
  }
  
  let stElem = document.querySelector('.script-thumb')
  if(stElem) {
    ajax.get(`/resources/${OS.resource.id}/raw`).then(function(res){
      let script = res.data
      var scriptDoc = new scratchblocks.Document(scratchblocks.fromJSON({scripts: [[0,0, script]]}).scripts);
      scriptDoc.render(function(svg) {
        stElem.appendChild(svg)
      })
    })
  }
  
  let title = document.querySelector(".resource-title")
  
  title.addEventListener('keyup', function(e){
    if(e.which == 13 && e.ctrlKey){
      this.blur()
    }
  })
  
  title.addEventListener("blur", async function(){
    this.scrollTop = 0
    let title_raw = title.innerText
    
    clearTimeout(timeoutId)
    document.querySelector('.resource-title ~ small').innerHTML = 'Saving...'

    try {
      let csrfToken = window.csrf
      
      let res = await ajax.put(window.location.pathname + '/about', {
        title: title_raw,
        csrf: csrfToken
      })
      title_raw = JSON.parse(res.request.responseText).title
      title.innerText = title_raw
      
      document.querySelector('.resource-title ~ small').innerHTML = 'Saved'
      timeoutId = setTimeout(function(){
        document.querySelector('.resource-title ~ small').innerHTML = '&nbsp;'
      }, 2000)
    } catch(err){
      document.querySelector('.resource-title ~ small').innerHTML = 'Error'
      console.log(err)
    }
  })
}