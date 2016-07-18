const AudioThumb = require('./audio-thumb')

module.exports = {
  parse: function parseResources() {
    if(document.querySelectorAll('.resources').length > 0) {
      // this page has resources in it somewhere
      let resources = document.querySelectorAll('.resources > .resource')

      for (let el of resources) {
        let id = el.id
        let audio = el.querySelector('.audio')
        let image = el.querySelector('.img')
        let a = el.querySelector('a.to')
        
        el.addEventListener('dragstart', function(e){
          let img = this.querySelector('img')
          
          let itemJson = {
            name: this.dataset.name,
            id: this.dataset.id,
            type: this.dataset.type
          }
    
          e.dataTransfer.clearData();
          e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2)
          e.dataTransfer.setData('application/opensprites-items+json', JSON.stringify([itemJson]))
          e.dataTransfer.setData('application/opensprites-item-origin-resource-list+text', "yep")
        })

        if(audio) {
          AudioThumb(id, (function(audio, dataurl){
            audio.src = dataurl
          }).bind(this, audio.querySelector("img")))
          
          let play = audio.querySelector('.play')

          play.addEventListener('click', e => {
            if(audio.querySelector('audio').paused) {
              audio.querySelector('audio').play()
              audio.classList.add('play')
              play.innerHTML = 'pause'
            } else {
              audio.querySelector('audio').pause()
              audio.classList.remove('play')
              play.innerHTML = 'play_arrow'
            }

            e.stopPropagation()
            e.preventDefault()
            return false
          })

          play.addEventListener('mouseenter', e => {
            if(play.innerHTML === 'play_circle_outline') {
              play.innerHTML = 'play_arrow'
            } else if(play.innerHTML === 'pause_circle_outline') {
              play.innerHTML = 'pause'
            }
          })

          play.addEventListener('mouseleave', e => {
            if(play.innerHTML === 'play_circle_filled') {
              play.innerHTML = 'play_circle_outline'
            } else if(play.innerHTML === 'pause_circle_filled') {
              play.innerHTML = 'pause_circle_outline'
            }
          })

          audio.querySelector('audio').addEventListener('ended', e => {
            play.innerHTML = 'replay'
          })

          a.addEventListener('click', e => {
            if(e.target == play) {
              e.preventDefault()
              return false
            }

            return true
          })
        }
      }
    }
  }
}