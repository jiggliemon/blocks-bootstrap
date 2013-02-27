var config = require('config')
// var parse = require('parse')
// // initialize parse before everything else.
// // There's got to be a better way to handle this.
// parse.initialize(config.parse.appId, config.parse.jsKey)

// var Obj = require('parse/core')
// var Tas = Obj.extend('Task')
// Obj.initialize(config.parse.appId,config.parse.jsKey)

// var task = new Something()

var block = require('blocks/block')
var tmpl = require('text!./layouts/2-col-left.tmpl')
var header = require('./header/index')
var Left = require('./left/index')
var Todo = require('todo')
//var Countdown = require('countdown')

// var counter = new Countdown({
//    date:'12/25/2013 13:00'
//   ,offset: -6
// })

var page = new block('page', {
   template:tmpl
  ,children: {
     header: new header('header')
    ,left: [new Left]
    ,content: [new Todo('content-todo')]
  }
})




document.body.appendChild(page.toElement())

module.exports = page