const console = require('loggy')
console.notificationsTitle = 'OpenSprites Server'

if(process.env.sendgrid_api_key) {
  const helper = require('sendgrid').mail
  const sg = require('sendgrid').SendGrid(process.env.sendgrid_api_key)

  module.exports = function email(to, subject, content, from='hi') {
    return new Promise((done, reject) => {
      const fromEmail = new helper.Email(from + '@opensprites.org', 'OpenSprites')
      const toEmail = new helper.Email(to)
      const html = new helper.Content('text/html', content)
      const mail = new helper.Mail(fromEmail, subject, toEmail, html)

      const body = mail.toJSON()
      const req = sg.emptyRequest()
      req.method = 'POST'
      req.path = '/v3/mail/send'
      req.body = body

      sg.API(req, function(res) {
        if(res.statusCode === 202) {
          done(res)
        } else {
          console.warn('Cannot send email; SendGrid gave statusCode ' + res.statusCode)
          reject(res)
        }
      })
    })
  }
} else {
  module.exports = async function thereIsNoSendGrid() {
    console.warn('Cannot send email; `sendgrid_api_key` is undefined')
    throw 'no api key'
  }
}
