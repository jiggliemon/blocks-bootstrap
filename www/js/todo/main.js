var block = require('blocks/block')
var tmpl = require('text!./tmpl/layout.tmpl')
var parse = require('parse/object')

var TodoCreate = require('./create')
var TodoList = require('./list')

var TodoApp = block.create({
  template: tmpl
  ,children: {
    header: [TodoCreate]
    ,body: [TodoList]
  }
},{
   name: 'todo'
  ,getName: function () {
    return this.name
  }
})

module.exports = TodoApp