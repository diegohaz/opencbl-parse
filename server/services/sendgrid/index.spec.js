'use strict'

import nock from 'nock'
import * as sendgrid from './'

describe('Sendgrid Service', function () {
  it('should send email', function () {
    nock('https://api.sendgrid.com')
      .post('/v3/mail/send')
      .reply(202, (uri, requestBody) => requestBody)

    return sendgrid.sendMail({
      toEmail: 'hazdiego@gmail.com',
      subject: 'Test',
      content: '<h1>Just Testing</h1>'
    }).then((res) => {
      res.should.have.property('statusCode', 202)
    })
  })
})
