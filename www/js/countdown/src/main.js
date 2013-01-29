var block = require('blocks/block')
var CountdownModel = require('./models/countdown')
//var CountdownTemplate = require('text!./tmpl/countdown.tmpl')
//var styles = require('text!./styles/countdown.css')
var timebomb = require('./themes/timebomb')
var plain = require('./themes/plain')

var themes = {
  "timebomb": timebomb 
  ,"plain": plain
}

function loadCss(styles) {
    var style = document.createElement("style");
    style.innerHTML = styles
    document.getElementsByTagName("head")[0].appendChild(style);
}

var CountdownBlock = block.create({
   theme: "timebomb"
  ,context: {
    pad: CountdownModel.pad
  }
  ,date: "12/25/2012"
  ,offset: -6
}, {
  construct: function (options) {
    var self = this
    self.setOptions(options || {})

    if (!self.options.template) {
      self.setTheme(self.options.theme)
    }

    self.model = new CountdownModel({
       date: self.options.date
      ,offset: parseFloat(self.options.offset, 10)
    })

    self.model.addEvent('time:changed', function (key, time) {
      var el = self.bound(key)
      if (el) {
        el.innerHTML = CountdownModel.pad(time, 2)
      }
      self.fireEvent('time:changed',key,time)
    })
    self.model.addEvent('time:ended', function () {
      self.fireEvent('time:ended:latched')
    })
  }

  ,getDelta: function (what) {
    return this.model.getDelta(what)
  }
  
  ,setTheme: function (theme) {
    var self = this
    if (themes[theme]) {
      self.options.template = themes[theme].template
      if (!themes[theme].loaded) {
        loadCss(themes[theme].styles)
        themes[theme].loaded = true
      }
    }
  }

})

  
module.exports = CountdownBlock