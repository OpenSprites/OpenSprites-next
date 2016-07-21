/** unused! **/

var process = {
  // /ban @phantomjs
  argv: require('system').args
}

var file = process.argv[1] || 'public/assets/img/doodle/exit.png'
var auth = process.argv[2] === 'true'
var user = process.argv[3]
var pass = process.argv[4]

var echo = true

////

var casper = require('casper').create({ verbose: true, logLevel: 'info' })
casper.start('http://cubeupload.com/')

casper.then(function doUpload() {
  // let's do some uploading
  //this.click('#pickfiles')
  if(echo) this.echo('Uploading')

  this.evaluate(function(f) {
    $('input[type="file"]').val(f)
  }, { f: file })

  if(echo) this.echo('Upload complete')

  this.click('#uploadfiles')
  this.capture('screen.png', {
    top: 0,
    left: 0,
    width: 1000,
    height: 1000
  })
})

var direct_link = 'input[title="Direct Link"]'
casper.waitForSelector(direct_link, function getDirectLink() {
  this.echo(this.getElementAttribute(direct_link, 'value'))
})

casper.run()
