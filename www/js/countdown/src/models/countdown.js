var EventsMixin = require('yeah/mixin')
var extend = require('yaul/extend')
var typeOf = require('yaul/typeOf')

function keys (obj) {
  var arr = []
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      arr.push(key)
    }  
  }
  return arr
}

function getNow () {
  var date = new Date()
  date.setMilliseconds(0)
  return date
}

function getOffsetDate (date, offset) {
    var d = typeof date === 'string' ? new Date(date) : new Date(date.getTime())
    // var remoteOffset = offset * 3600000
     // var localOffset = offset + d.getTimezoneOffset()/60
     // d.setHours(d.getHours() + localOffset)
     // console.log(d.getHours())
    return d
}

// Thinking about making this fancier.
function obliterateDelta (seconds) {
  var secondsPer = {
       days:86400
      ,hours:3600
      ,minutes: 60
      ,seconds:1
    }
    ,outputDog = {days:0,hours:0,minutes:0,seconds:0}

  function extractSection ( numSecs,key ) {
    var amount = 0

    if (numSecs > 0) {
      amount = Math.floor( seconds / secondsPer[key] );
      seconds -= amount * secondsPer[key];

    }
    return amount;
  }
  
  for (var key in outputDog) {
    if (outputDog.hasOwnProperty(key)){
      outputDog[key] = extractSection(seconds, key)
    }
  }
  
  return outputDog
}


function Countdown(date) {
  var self = this
  if ( !(self instanceof Countdown)) {
    return new Countdown(date)
  }
  self.construct.call(self,date)
}


Countdown.prototype = extend({
  construct: function (options) {
    options = options || {}
    var self = this
    var date = self.date = options.date
    var offset = self.offset = options.offset || 0

    var type = typeOf(date)

    if (type == 'string') {
      date = self.date = getOffsetDate(date, offset)
      if (date == "Invalid Date") {
        throw new Error('Invalid `Date` format provided')
      }
    }

    self.time = self.getDelta('map')
    self.keys = keys(self.time)
    if (self.isDone()){
      self.fireEvent('time:ended:latched')
    } else {
      self.start()  
    }
    
  },

  isDone: function () {
    var self = this
    var i = self.keys.length
    var delta = self.getDelta('map')
    var key, el, parent, latch = 0, val
    while (i--) {
      key = self.keys[i]
      val = delta[key]
      if (val > latch) {
        latch = val
      }
    }
    return (!latch)
  },
  // This method feels like it should be using
  // some recursive check for the incrimentation
  tick: function () {
    var self = this
    var delta = self.getDelta('map')
    var i = self.keys.length
    var key, el, parent, latch = 0, val
    while (i--) {
      key = self.keys[i]
      val = delta[key]
      if (self.time[key] !== val) {
        self.fireEvent('time:changed',key,delta[key])
      }
    }
    this.time = delta
    if (this.isDone()) {
      this.stop()
      self.fireEvent('time:ended:latched')
    }
  },
  
  getDelta: function (what) {
    var self = this
    switch (what) {
      case undefined:
        var now = getNow()
        var milisecondTime = self.date.getTime() - now.getTime()
        var hourDifference = self.offset + (now.getTimezoneOffset()/60) 
        var milisecondOffset = hourDifference * 3600000 
        var delta = ( milisecondTime - milisecondOffset)
        return Math.floor(delta/1000)
        break;
        
      case 'map':
        var time = obliterateDelta(self.getDelta())
        return time
        break;
        
      default:
        return self.time[what] 
    }
  },
  
  stop: function () {
    clearInterval(this.interval)
    this.fireEvent('time:stopped')
  },

  start: function () {
    var self = this
    var ticker = function () {
      self.tick()
    }

    self.interval = setInterval(ticker, 1000)
    self.fireEvent('time:started')
  }
}, EventsMixin)

Countdown.pad = function zeroPad ( number, width ) {
  width -= number.toString().length;
  return String( (width > 0) ? new Array(width +(/\./.test(number)?2:1)).join('0') + number : number );
}


module.exports = Countdown