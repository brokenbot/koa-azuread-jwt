'use strict'

let rest = require('restler')

function getOAuthURL (url) {
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

function convertPEM (certString) {
  let cur = 0

  let pem = '-----BEGIN CERTIFICATE-----\n'
  while (cur < certString.length) {
    if (certString.length > cur + 64) {
      pem += certString.substring(cur, cur + 64)
    } else {
      pem += certString.substring(cur)
    }
    cur += 64
    pem += '\n'
  }
  pem += '-----END CERTIFICATE-----\n'
  return pem
}


module.exports = function certCache (certificateURL, refreshInterval) {
  let url = certificateURL || 'https://login.windows.net/common/discovery/keys'
  let interval = refreshInterval || 24 * 60 * 60 * 1000
  let certs = {}

  function refreshCache () {
    return getOAuthURL(url).then(function (resp) {
      if (resp.keys) {
        certs = {
          refresh: new Date() + interval
        }
        resp.keys.map(function (key) {
          console.log('Adding certificate with id %s to cache.', key.kid)
          certs[key.kid] = { cert: convertPEM(key.x5c[0]) }
        })
      }
      return resp
    })
  }

  function getCert (id, attempt) {
    attempt = attempt || 0
    if (certs[id]) {
      if (refreshInterval >= new Date()) {
        console.log('reached cert cache refresh interval')
        refreshCache()
      }
      Promise.resolve(certs[id])
    } else {
      console.log('certificate cache miss for cert: %s', id)
      return refreshCache().then(function (resp) {
        if (certs[id]) {
          return certs[id]
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
