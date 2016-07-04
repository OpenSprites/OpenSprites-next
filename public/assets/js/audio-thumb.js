module.exports = function(id, cb) {
  if(window.Worker && window.AudioContext) {
    // yay, let's render a nicer thumbnail
    
    let updateImage = function(dataurl){
      localStorage['audio-thumbcache-' + id] = dataurl
      if(cb) {
        cb(dataurl)
      }
    }
    
    let runAudioRender = function() {
      var audioContext = new AudioContext();
      
      var canvasWidth = 240, canvasHeight = 240
      var newCanvas = document.createElement('canvas')
      newCanvas.width = canvasWidth
      newCanvas.height = canvasHeight
      var context = newCanvas.getContext('2d')
      
      var worker = new Worker('/assets/js/audio-thumb-worker.js')
      worker.onmessage = function(e) {
        /*context.save()
        context.fillStyle = 'transparent'
        context.fillRect(0, 0, canvasWidth, canvasHeight)
        context.strokeStyle = '#659593'
        context.globalCompositeOperation = 'lighter'
        context.translate(0,canvasHeight / 2)
        for(let line of e.data) {
          let x = line[0]
          let y = line[1]
          context.beginPath()
          context.moveTo(x, -y)
          context.lineTo(x, y)
          context.stroke()
        }
        context.restore()*/
        console.log("Got back some data", e.data)
        context.putImageData(e.data, 0, 0);
        
        updateImage(newCanvas.toDataURL())
      }
    
      let req = new XMLHttpRequest();
      req.open("GET", '/resource/' + id + '/raw', true);
      req.responseType = "arraybuffer";    
      req.onreadystatechange = function (e) {
        if (req.readyState == 4) {
          if(req.status == 200)
            audioContext.decodeAudioData(req.response, function(buffer) {
              worker.postMessage([buffer.getChannelData(0), context.createImageData(canvasWidth, canvasHeight)]);
          }, err => console.log(err));
        }
      };
      req.send();
    }
     
    if(!localStorage['audio-thumbcache-' + id]){
      runAudioRender()
    } else {
      updateImage(localStorage['audio-thumbcache-' + id])
    }
  }
}