var tenantid = process.env.TENANTID
var appid = process.env.APPID

console.log({ app_id: appid, tenant_id: tenantid })

var koa = require('koa')
var koaJWT = require('../')

var azureAD = koaJWT(tenantid, appid)
var app = koa()

app.use(azureAD)
app.use(function *() {
  this.status = 200
})

app.listen(3001)
