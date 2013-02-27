var block = require('blocks/block')
var tmpl = require('text!../tmpl/list.tmpl')
var lang = require('i18n!../nls/todo')

var Task = require('../blocks/task')

var task1 = new Task({task: 'Go shopping'})
var task2 = new Task({task: 'Go hunting'})

var TodoList = block.create({
   template:tmpl
  ,lang: lang
  ,children: {
    items: [task1, task2]
  }
}, {

})

module.exports = TodoList