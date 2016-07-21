const path = require('path')
const fs = require('fs')
const req = require('request')
const stream = require('stream')

const dir = 'temp/'

if(!fs.existsSync(dir)) {
  fs.mkdirSync(dir)
}

module.exports = function cubeupload(file) {
  return new Promise((done, reject) => {
    const pathToFile = path.join(dir, 'cubeupload-' + Math.floor(Date.now() + Math.random() * 2))

    fs.writeFile(pathToFile, file, 'utf8', err => {
      if(err) {
        reject(err)
        return
      }

      req.post({
        url: 'http://cubeupload.com/upload_json.php',
        form: {
          name: '',
          userHash: false,
          userID: false,
          'fileinput': [ fs.createReadStream(pathToFile) ]
        },
        json: true
      }, function(err, res, body) {
        if(err) reject(err)
        else done(body)
      })
    })
  })
}
