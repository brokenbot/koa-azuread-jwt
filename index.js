'use strict'

let rest = require('restler')
let jwt = require('jsonwebtoken')

function getOAuthURL(url) {
  return new Promise(function (resolve, reject) {
    rest.get(url)
      .on('success', function (data) {
        resolve(data)
      })
      .on('error', function (err) {
        reject(err)
      })
      .on('fail', function (data, response) {
        reject(new Error('Request failed with code: ' + response + ' message: ' + data))
      })
      .on('timeout', function (ms) {
        reject(new Error('Request took longer than: ' + ms + 'ms'))
      })
  })
}

function convertPEM(certString) {
  let cur = 0

  let PEM = "-----BEGIN CERTIFICATE-----";
  while (cur < certString.length) {
    if (certString.length > cur + 64) {
      PEM += "\n" + certString.substring(cur, cur + 64)
    } else {
      PEM += "\n" + certString.substring(cur)
    }
    cur += 64
  }
  PEM += "\n";
  PEM += "-----END CERTIFICATE-----\n";
  return PEM;
}


function certCache(certificateURL, refreshInterval) {
  let url = certificateURL || 'https://login.windows.net/common/discovery/keys'
  let interval = refreshInterval || 24 * 60 * 60 * 1000
  let certs = {}

  function refreshCache() {
    console.log('refreshing cache')
    return getOAuthURL(url).then(function (resp) {
      if (resp.keys) {
        certs = {
          refresh: new Date + interval
        }
        resp.keys.map(function (key) {
          console.log("Adding certificate with id %s to cache.", key.kid)
          certs[key.kid] = { cert: convertPEM(key.x5c[0]) }
        })
      }
      return resp
    })
  }

  function getCert(id, attempt) {
    attempt = attempt || 0
    if (certs[id]) {
      if (refreshInterval >= new Date) {
        console.log('reached cert cache refresh interval')
        refreshCache()
      }
      Promise.resolve(certs[id])
    } else {
      console.log('certificate cache miss for cert: %s', id)
      return refreshCache().then(function (resp) {
        if (certs[id]) {
          return certs[i]
        } else {
          throw new Error('Unable to get key ' + id + ' from cache or ' + url)
        }
      })
    }
  }

  let cache = {
    cert: getCert,

    refresh: refreshCache,

    list: function () {
      return certs
    }
  }

  cache.refresh(url)

  return cache
}

function validate(jwtString, key, options) {
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

module.exports = function init(applicationId, clientId) {
  let options = {
    aud: applicationId,
    iss: 'https://sts.windows.net/' + clientId + '/',
    algorithm: 'RS256'
  }
  let cert
  // evtentually this should fetch the clientId oauth config
  // for now it will return the default certs from ms
  let cache = certCache()

  return function* koa_azuread_jwt(next) {
    let jwtEncoded
    // check query and authorization header
    if (this.query.jwt) {
      console.log('using jwt in query')
      jwtEncoded = this.query.jwt
    }
    // check for authorization header
    if (this.get('authorization')) {
      console.log('using jwt in authorization header')
      jwtEncoded = this.header.get('authorization').split(' ')[1]
    }

    if (jwtEncoded) {
      let decoded = jwt.decode(jwtEncoded, { complete: true })
      if (decoded) {
        //if (decoded.payload.exp < new Date/1000 || 0) {
        //  this.body = "Expired Token"
        //  this.status = 401
        //  return
        //}
        if (decoded.payload.aud !== options.aud) {
          this.body = "Invalid Audience in Token"
          this.status = 401
          return
        }
        if (decoded.payload.iss !== options.iss) {
          this.body = "Invalid Issuer in Token"
          this.status = 401
          return
        }
        try {
          cert = yield cache.cert(decoded.header.kid)
        } catch (err) {
          this.body = "Failed to get Token Signing Certificate"
          this.status = 500
          return
        }
      } else {
        this.status = 401
        return
      }
      try {
        this.user = yield validate(jwtEncoded, cert.cert, options)
      } catch (err) {
        console.log('validate error: ' + err)
        this.body = err
        this.status = 401
        return
      }
      yield next
    }

  }
}