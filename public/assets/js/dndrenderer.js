function nItems(n, size) {
  let canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  
  let ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(100, 255, 255, 0.5)'
  ctx.fillRect(0, size / 4, size, size / 2)
  ctx.font = "20px 'Lato',sans-serif";
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillStyle = 'white'
  ctx.fillText(n + " items", size / 2, size / 2, size);
  
  let dataUrl = canvas.toDataURL()
  let img = new Image(size, size)
  img.src = dataUrl
  return img
}

module.exports = {
  nItems
}