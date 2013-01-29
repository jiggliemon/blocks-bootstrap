var block = require('blocks/block')
var tmpl = require('text!../tmpl/task.tmpl')
var editTmpl = require('text!../tmpl/task.edit.tmpl')

var TaskView = block.create({
  template: tmpl
  ,events: {
    label: {
      click: function (e, self) {
        var wrapper = self.bound('wrapper')
        var checkbox = self.bound('checkbox')

        wrapper.classList[(checkbox.checked)?'add':'remove']('live')
        console.log('wraooer')
      }
    }
  }
},{
  construct: function (data, options) {
    this.data = data
  }
  ,getTask: function () {
    return this.data.task
  }
})

module.exports = TaskView