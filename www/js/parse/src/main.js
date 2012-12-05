var extend = require('lodash').extend
var indexOf = require('lodash').indexOf
var clone = require('lodash').clone
var user = require('./user')

// Create some default configurations.
// we'll extend the local defaults with the options passed in with
// the require.js configuration options
var config = extend({
  useMasterKey: false
  ,apiVersion: 1
  ,allowedRoutes: ["classes","push","users","login","functions","requestPasswordReset"]
  ,serverURL: "https://api.parse.com"
}, (module.config && module.config())

var Parse = {
  
   VERSION : "js1.1.13"


  ,initialize: function (applicationId, javaScriptKey, masterKey) {
    var self = this
    self.applicationId = applicationId
    self.javaScriptKey = javaScriptKey
    self.masterKey = masterKey
  }

  ,request: function (route, className, objectId, method, dataObject, options) {
    if (!Parse.applicationId) {
      throw new Error("You must specify your applicationId using Parse.initialize")
    }

    if (!Parse.javaScriptKey && !Parse.masterKey) {
      throw new Error("You must specify a key using Parse.initialize")
    }

    if (indexOf(config.allowedRoutes,route) === -1) {
      throw new Error("First argument must be one of classes, users, functions, or login, not '" + route + "'.")
    }

    var url = [config.serverURL, config.apiVersion, route]

    if (className) {
      url.push(className)
    }

    if (objectId) {
      url.push(objectId)
    }

    dataObject = extend({}, dataObject);

    if (method !== "POST") {
      // This is needed for the parse api
      // method myst have the leading _
      // the request method must also be
      // a POST request.
      dataObject._method = method;
      method = "POST";
    }

    dataObject._ApplicationId = Parse.applicationId

    if (!config.useMasterKey) {
      dataObject._JavaScriptKey = Parse.javaScriptKey;
    } else {
      dataObject._MasterKey = Parse.masterKey;
    }
    
    dataObject._ClientVersion = Parse.VERSION;
    dataObject._InstallationId = getInstallationId(Parse)

    // Pass the session token on every request.
    var currentUser = User.current();
    if (currentUser && currentUser._sessionToken) {
      dataObject._SessionToken = currentUser._sessionToken;
    }
    var data = JSON.stringify(dataObject);

    ajax(method, url.join('/'), data, options.success, options.error);
  }

  ,extend: function (protoProps, classProps) {
    var child = inherits(this, protoProps, classProps);
    child.extend = this.extend;
    return child;
  }

}


function getParsePath (path) {
  path = String(path || "")
  
  if (!Parse.applicationId) {
    throw new Error("You need to call Parse.initialize before using Parse.")
  }

  if (path.charAt(0) === "/") {
    path = path.substring(1)
  }

  return ["Parse", Parse.applicationId, path].join('/')
}


function getInstallationId (what) {
    var self = this
    // See if it's cached in RAM.
    if (what._installationId) {
      return what._installationId
    }

    // Try to get it from localStorage.
    var path = getParsePath("installationId")
    what._installationId = localStorage.getItem(path)

    if (!what._installationId || what._installationId === "") {
      // It wasn't in localStorage, so create a new one.
      function hexOctet () {
        return Math.floor((1+Math.random())*0x10000).toString(16).substring(1)
      }
      what._installationId = (
        hexOctet() + hexOctet() + "-" +
        hexOctet() + "-" +
        hexOctet() + "-" +
        hexOctet() + "-" +
        hexOctet() + hexOctet() + hexOctet())
      localStorage.setItem(path, what._installationId)
    }

    return what._installationId
  }
}

// Shared empty constructor function to aid in prototype-chain creation.
var EmptyConstructor = function () {}


// Helper function to correctly set up the prototype chain, for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
var inherits = function (parent, protoProps, staticProps) {
  var child

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent's constructor.
  if (protoProps && protoProps.hasOwnProperty('constructor')) {
    child = protoProps.constructor
  } else {
    /** @ignore */
    child = function(){ 
      parent.apply(this, arguments)
    }
  }

  // Inherit class (static) properties from parent.
  extend(child, parent)

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function.
  EmptyConstructor.prototype = parent.prototype
  child.prototype = new EmptyConstructor()

  // Add prototype properties (instance properties) to the subclass,
  // if supplied.
  if (protoProps) {
    extend(child.prototype, protoProps)
  }

  // Add static properties to the constructor function, if supplied.
  if (staticProps) {
    extend(child, staticProps)
  }

  // Correctly set child's `prototype.constructor`.
  child.prototype.constructor = child

  // Set a convenience property in case the parent's prototype is
  // needed later.
  child.__super__ = parent.prototype

  return child
}


function ajaxIE8 (method, url, data, success, error) {
  var xdr = new XDomainRequest()
  xdr.onload = function() {
    var response
    try {
      response = JSON.parse(xdr.responseText)
    } catch (e) {
      if (error) {
        error(xdr)
      }
    }
    if (response) {
      if (success) {
        success(response, xdr)
      }
    }
  }
  xdr.onerror = xdr.ontimeout = function() {
    error(xdr)
  }
  xdr.onprogress = function() {}
  xdr.open(method, url)
  xdr.send(data)
}

function ajax (method, url, data, success, error) {
  if (typeof(XDomainRequest) !== "undefined") {
    return ajaxIE8(method, url, data, success, error)
  }

  var handled = false

  var xhr = new XMLHttpRequest()
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (handled) {
        return
      }
      handled = true

      if (xhr.status >= 200 && xhr.status < 300) {
        var response;
        try {
          response = JSON.parse(xhr.responseText)
        } catch (e) {
          if (error) {
            error(xhr)
          }
        }
        if (response) {
          if (success) {
            success(response, xhr)
          }
        }
      } else {
        if (error) {
          error(xhr)
        }
      }
    }
  }
  xhr.open(method, url, true);
  xhr.setRequestHeader("Content-Type", "text/plain")  // avoid pre-flight.
  xhr.send(data)
}


function stripTrailingSlash(str) {
  var leng = str.length -1
  return (str.charAt(leng) == '/') ? str.substr(0, leng) : str
}
    

if (config.appId && config.jsKey) {
  Parse.initialize(config.appId, config.jsKey)
}









module.exports = Parse