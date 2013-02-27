var block = require('blocks/block')
var Obj = require('parsed/object')

var tmpl = require('text!../tmpl/task.tmpl')
var editTmpl = require('text!../tmpl/task.edit.tmpl')

var TaskBlock = block.create({
   template: tmpl
  ,events: {
    label: {
      click: function (e, self) {
        var wrapper = self.bound('wrapper')
        var checkbox = self.bound('checkbox')
        wrapper.classList[(checkbox.checked)?'add':'remove']('live')
      }
    }
  }
},{
  construct: function (dataOrId, options) {
    this.data = dataOrId
  }
  ,getTask: function () {
    return this.data.task
  }
})

module.exports = TaskBlock