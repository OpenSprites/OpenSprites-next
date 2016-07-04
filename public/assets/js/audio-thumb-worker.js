function displayBuffer(leftChannel, imageData) {
  var canvasWidth = 240, canvasHeight = 240
  
  for (var i = 0; i < leftChannel.length; i += Math.ceil(leftChannel.length / (canvasWidth * 2))) {
    var x = Math.floor(canvasWidth * i / leftChannel.length)
    var y = Math.floor(leftChannel[i] * canvasHeight / 2)
    
    for(var yi = -y + canvasHeight / 2; yi <= y + canvasHeight / 2; yi++){
      let addr = yi * canvasWidth + x
      addr *= 4
      imageData.data[addr] = 101
      imageData.data[addr + 1] = 149
      imageData.data[addr + 2] = 147
      imageData.data[addr + 3] = 255
    }
  }
  
  console.log('done processing', imageData)
  
  postMessage(imageData)
}

onmessage = function(e) {
  displayBuffer(e.data[0], e.data[1])
}