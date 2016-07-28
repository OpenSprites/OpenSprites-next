const path = require('path')
const req = require('request')


module.exports = function cubeupload(file, mimetype) {
  return new Promise((done, reject) => {
    let ext = mimetype.split('/')[1]

    req.post({
      url: 'http://cubeupload.com/upload_json.php',
      formData: {
        name: 'file.' + ext,
        userHash: 'false',
        userID: 'false',
        'fileinput[0]': {
          value: file,
          options: {
            filename: 'topsecret.' + ext,
            contentType: mimetype
          }
        }
      },
      json: true
    }, function(err, res, body) {
      if (err) reject(err)
      else done(body)
    })
  })
}
