var client = process.env.cid
var app = process.env.app
var jwt = process.env.jwt

console.log({ app: app, client: client })

var koa = require('koa')
var koaJWT = require('./')

var azureAD = koaJWT(app, client)
var app = koa()

app.use(azureAD)
app.use(function *() {
  this.status = 200
})

app.listen(3001)