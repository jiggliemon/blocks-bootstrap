var block = require('blocks/block')
var CountdownModel = require('./models/countdown')
var CountdownTemplate = require('text!./tmpl/countdown.tmpl')
var styles = require('text!./styles/countdown.css')


function loadCss(styles) {
    var style = document.createElement("style");
    style.innerHTML = styles
    document.getElementsByTagName("head")[0].appendChild(style);
}

loadCss(styles)

var CountdownBlock = block.create({
   template: CountdownTemplate
  ,context: {
    pad: CountdownModel.pad
  }
  ,date: "12/25/2012"
  ,events: {
    'seconds':{
      'seconds.changed': function (e, self) {

      }
    }
  }
}, {
  construct: function () {
    var self = this
    self.model = new CountdownModel({date: self.options.date})
    self.model.addEvent('time:changed', function (key, time) {
      var el = self.bound(key)
      if (el) {
        el.innerHTML = CountdownModel.pad(time, 2)
      }
    })
  }
  ,getDelta: function (what) {
    return this.model.getDelta(what)
  }

})

  
module.exports = CountdownBlock