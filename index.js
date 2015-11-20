'use strict'

let certCache = require('./lib/cert-cache')
let jwt = require('jsonwebtoken')


function validate (jwtString, key, options) {
  return new Promise(function (resolve, reject) {
    jwt.verify(jwtString, key, options, function (err, payload) {
      if (err) {
        reject(err)
      } else {
        resolve(payload)
      }
    })
  })
}

module.exports = function init (tenantId, applicationId) {
  let options = {
    aud: applicationId,
    iss: 'https://sts.windows.net/' + tenantId + '/',
    algorithm: 'RS256'
  }
  let cert
  let cache = certCache()

  return function * koa_azuread_jwt (next) {
    let jwtEncoded
    // check query and authorization header
    if (this.query.jwt || this.query.token) {
      jwtEncoded = this.query.jwt || this.query.token
    }
    // check for authorization header
    if (this.get('authorization')) {
      jwtEncoded = this.get('authorization').split(' ')[1]
    }

    if (jwtEncoded) {
      let decoded = jwt.decode(jwtEncoded, { complete: true })
      if (decoded) {
        if (decoded.payload.exp < new Date() / 1000 | 0) {
          this.body = 'Expired Token'
          this.status = 401
          return
        }
        if (decoded.payload.aud !== options.aud) {
          this.body = 'Invalid Audience in Token'
          this.status = 401
          return
        }
        if (decoded.payload.iss !== options.iss) {
          this.body = 'Invalid Issuer in Token'
          this.status = 401
          return
        }
        try {
          cert = yield cache.cert(decoded.header.kid)
        } catch (err) {
          this.body = 'Failed to get Token Signing Certificate'
          this.status = 500
          return
        }
      } else {
        this.status = 401
        return
      }
      try {
        this.state.user = yield validate(jwtEncoded, cert.cert, options)
      } catch (err) {
        this.body = err
        this.status = 401
        return
      }
      yield next
    }
  }
}
