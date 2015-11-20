# Koa middleware for Azure AD JWT validation

Handles fetching and caching of Azure AD validation certficates.

### Warning

Though this module is basically functional it's still in development and has not been heavily tested or vetted.

# Usage

```javascript
let kao = require('koa')
let azureadJWT = require('koa-azuread-jwt')
let app = koa()

app.use(azureadJWT('tentantidstring', 'appliationidstring')

app.use(function *() {
	this.status = 200
})

app.listen(3000)
```

**koa-azuread-jwt(\<string>tentantId, \<string>applicationId)** returns a generator to be used as koa middleware

## Notes
Cert cache attempts to refresh when a legitimate looking cert without and signing cert in the cache is requested.  Or when a call is made and the cert cache has exceed the refresh interval.  The refresh interval is currently 24 hours.  

Certificates are currently pulled directly from https://login.windows.net/common/discovery/keys.  This will change in the future to use the tenant oauth discovery.

The test current just loads a koa server and allows requests with JWT to be sent and validated or rejected.

Tokens can be passed either in the authorizatin header or the query (eg. ?jwt=encoded_jwt), if found in both the authorization header will be preferred.

A basic prevalidation is performed on the jwt before the actual jwt verification with the cert is completed.  This is to avoid refreshing the cache when an invalid it token is sent.

If an invalid JWT is found a 401 is returned and next will not be called.


## Todo
* Add some actual tests
* Support selecting or deselecting paths to be validated
* Much better refresh logic, with configurable refresh intervals
* Better error handling
* Consistent return status messages
* support multiple applications