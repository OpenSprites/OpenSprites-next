const console = require('loggy')
console.notificationsTitle = 'OpenSprites Server'

let sendMail

if(process.env.sendgrid_api_key) {
  const helper = require('sendgrid').mail
  const sg = require('sendgrid').SendGrid(process.env.sendgrid_api_key)

  sendMail = function(to, subject, htmlContent, textContent, from='hi') {
    return new Promise((done, reject) => {
      const fromEmail = new helper.Email(from + '@opensprites.org', 'OpenSprites')
      const toEmail = new helper.Email(to)
      const html = new helper.Content('text/html', htmlContent)
      const text = new helper.Content('text/plain', textContent)
      const mail = new helper.Mail(fromEmail, subject, toEmail, html)
      mail.addContent(text)

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
  sendMail = async function thereIsNoSendGrid(to, subject, html, text) {
    console.warn('Cannot send email; `sendgrid_api_key` is undefined')
    console.log(to, subject, html, text)
  }
}

module.exports = {
  _send: sendMail,
  /**
   * exprhbsInst: the exprhbsInst from main.js
   * context: {
   *   to,
   *   subject,
   *   message,
   *   actions: [
   *     {
   *       label,
   *       url,
   *       primary: true/false
   *     }
   *   ]
   * }
   */
  email: async function(exprhbsInst, context) {
    let subject = context.subject
    let html = await exprhbsInst.render('public/views/email/html.hbs', context)
    let text = await exprhbsInst.render('public/views/email/plain.hbs', context)
    let to = context.to
    return await sendMail(to, subject, html, text)
  }
}
