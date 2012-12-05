var _ = require('lodash')
var extend = require('lodash').extend
var each = require('lodash').each
// var Obj = require('./object')
// var Op = require('./op')
// var ACL = require('./acl')
// var Relation = require('./relation')
// var User = require('./user')
// var GeoPoint = require('./geopoint')

/**
 * Contains all Parse API classes and functions.
 * @name Parse
 * @namespace
 *
 * Contains all Parse API classes and functions.
 */
var Parse = {
  VERSION : "js1.1.13"
}


// Import Parse's local copy of underscore.
// if (typeof(exports) !== "undefined" && exports._) {
//   // We're running in Node.js.  Pull in the dependencies.
//   Parse._ = exports._.noConflict();
//   Parse.localStorage = require('localStorage');
//   Parse.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
//   exports.Parse = Parse;
// } else {
  // Parse._ = _.noConflict();

  // if (typeof(localStorage) !== "undefined") {
  //   Parse.localStorage = localStorage;
  // }
  // if (typeof(XMLHttpRequest) !== "undefined") {
  //   Parse.XMLHttpRequest = XMLHttpRequest;
  // }
// }

// // If jQuery or Zepto has been included, grab a reference to it.
// if (typeof($) !== "undefined") {
//   Parse.$ = $;
// }

// Helpers
// -------

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

// Set the server for Parse to talk to.
Parse.serverURL = "https://api.parse.com"

/**
 * Call this method first to set up your authentication tokens for Parse.
 * You can get your keys from the Data Browser on parse.com.
 * @param {String} applicationId Your Parse Application ID.
 * @param {String} javaScriptKey Your Parse JavaScript Key.
 */
Parse.initialize = function (applicationId, javaScriptKey) {
  Parse._initialize(applicationId, javaScriptKey)
};

/**
 * Call this method first to set up master authentication tokens for Parse.
 * This method is for Parse's own private use.
 * @param {String} applicationId Your Parse Application ID.
 * @param {String} javaScriptKey Your Parse JavaScript Key.
 * @param {String} masterKey Your Parse Master Key.
 */
Parse._initialize = function (applicationId, javaScriptKey, masterKey) {
  Parse.applicationId = applicationId
  Parse.javaScriptKey = javaScriptKey
  Parse.masterKey = masterKey
  Parse._useMasterKey = false
};

/**
 * Returns prefix for localStorage keys used by this instance of Parse.
 * @param {String} path The relative suffix to append to it.
 *     null or undefined is treated as the empty string.
 * @return {String} The full key name.
 */
Parse._getParsePath = function (path) {
  if (!Parse.applicationId) {
    throw "You need to call Parse.initialize before using Parse."
  }
  if (!path) {
    path = ""
  }
  if (typeof path !== 'string') {
    throw "Tried to get a localStorage path that wasn't a String."
  }
  if (path[0] === "/") {
    path = path.substring(1)
  }
  return "Parse/" + Parse.applicationId + "/" + path
};

/**
 * Returns the unique string for this app on this machine.
 * Gets reset when localStorage is cleared.
 */
Parse._installationId = null;
Parse._getInstallationId = function () {
  // See if it's cached in RAM.
  if (Parse._installationId) {
    return Parse._installationId
  }

  // Try to get it from localStorage.
  var path = Parse._getParsePath("installationId");
  Parse._installationId = Parse.localStorage.getItem(path)

  if (!Parse._installationId || Parse._installationId === "") {
    // It wasn't in localStorage, so create a new one.
    var hexOctet = function() {
      return Math.floor((1+Math.random())*0x10000).toString(16).substring(1)
    };
    Parse._installationId = (
      hexOctet() + hexOctet() + "-" +
      hexOctet() + "-" +
      hexOctet() + "-" +
      hexOctet() + "-" +
      hexOctet() + hexOctet() + hexOctet())
    Parse.localStorage.setItem(path, Parse._installationId)
  }

  return Parse._installationId
};

Parse._parseDate = function (iso8601) {
  var regexp = new RegExp(
    "^([0-9]{1,4})-([0-9]{1,2})-([0-9]{1,2})" + "T" +
    "([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2})" +
    "(.([0-9]+))?" + "Z$");
  var match = regexp.exec(iso8601)
  if (!match) {
    return null
  }

  var year = match[1] || 0
  var month = (match[2] || 1) - 1
  var day = match[3] || 0
  var hour = match[4] || 0
  var minute = match[5] || 0
  var second = match[6] || 0
  var milli = match[8] || 0

  return new Date(Date.UTC(year, month, day, hour, minute, second, milli))
}

Parse._ajaxIE8 = function (method, url, data, success, error) {
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
  };
  xdr.onerror = xdr.ontimeout = function() {
    error(xdr);
  };
  xdr.onprogress = function() {}
  xdr.open(method, url)
  xdr.send(data)
};

Parse._ajax = function(method, url, data, success, error) {
  if (typeof(XDomainRequest) !== "undefined") {
    return Parse._ajaxIE8(method, url, data, success, error)
  }

  var handled = false

  var xhr = new Parse.XMLHttpRequest()
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (handled) {
        return
      }
      handled = true;

      if (xhr.status >= 200 && xhr.status < 300) {
        var response;
        try {
          response = JSON.parse(xhr.responseText);
        } catch (e) {
          if (error) {
            error(xhr);
          }
        }
        if (response) {
          if (success) {
            success(response, xhr);
          }
        }
      } else {
        if (error) {
          error(xhr);
        }
      }
    }
  };
  xhr.open(method, url, true);
  xhr.setRequestHeader("Content-Type", "text/plain");  // avoid pre-flight.
  xhr.send(data);
}

// A self-propagating extend function.
Parse._extend = function (protoProps, classProps) {
  var child = inherits(this, protoProps, classProps);
  child.extend = this.extend;
  return child;
}

/**
 * route is classes, users, login, etc.
 * objectId is null if there is no associated objectId.
 * method is the http method for the REST API.
 * dataObject is the payload as an object, or null if there is none.
 * options is just a success/error callback hash.
 * @ignore
 */
Parse._request = function (route, className, objectId, method, dataObject,
                          options) {
  if (!Parse.applicationId) {
    throw "You must specify your applicationId using Parse.initialize";
  }

  if (!Parse.javaScriptKey && !Parse.masterKey) {
    throw "You must specify a key using Parse.initialize";
  }

  
  if (route !== "classes" &&
      route !== "push" &&
      route !== "users" &&
      route !== "login" &&
      route !== "functions" &&
      route !== "requestPasswordReset") {
    throw "First argument must be one of classes, users, functions, or " +
          "login, not '" + route + "'.";
  }

  var url = Parse.serverURL;
  if (url.charAt(url.length - 1) !== "/") {
    url += "/";
  }
  url += "1/" + route;
  if (className) {
    url += "/" + className;
  }
  if (objectId) {
    url += "/" + objectId;
  }

  dataObject = _.clone(dataObject || {});
  if (method !== "POST") {
    dataObject._method = method;
    method = "POST";
  }
  dataObject._ApplicationId = Parse.applicationId;
  if (!Parse._useMasterKey) {
    dataObject._JavaScriptKey = Parse.javaScriptKey;
  } else {
    dataObject._MasterKey = Parse.masterKey;
  }
  
  dataObject._ClientVersion = Parse.VERSION;
  dataObject._InstallationId = Parse._getInstallationId();
  // Pass the session token on every request.
  var currentUser = User.current();
  if (currentUser && currentUser._sessionToken) {
    dataObject._SessionToken = currentUser._sessionToken;
  }
  var data = JSON.stringify(dataObject);

  Parse._ajax(method, url, data, options.success, options.error);
};

// Helper function to get a value from a Backbone object as a property
// or as a function.
Parse._getValue = function(object, prop) {
  if (!(object && object[prop])) {
    return null;
  }
  return _.isFunction(object[prop]) ? object[prop]() : object[prop];
};

// /**
//  * Converts a value in a Parse Object into the appropriate representation.
//  * This is the JS equivalent of Java's Parse.maybeReferenceAndEncode(Object)
//  * if seenObjects is falsey. Otherwise any Objs not in
//  * seenObjects will be fully embedded rather than encoded
//  * as a pointer.  This array will be used to prevent going into an infinite
//  * loop because we have circular references.  If <seenObjects>
//  * is set, then none of the Parse Objects that are serialized can be dirty.
//  */
// Parse._encode = function(value, seenObjects, disallowObjects) {
//   if (value instanceof Obj) {
//     if (disallowObjects) {
//       throw "Objs not allowed here";
//     }
//     if (!seenObjects || _.include(seenObjects, value) || !value._hasData) {
//       return value._toPointer();
//     } else if (!value.dirty()) {
//       seenObjects = seenObjects.concat(value);
//       return Parse._encode(value._toFullJSON(seenObjects),
//                            seenObjects,
//                            disallowObjects);
//     } else {
//       throw "Can't fully embed a dirty object";
//     }
//   } else if (value instanceof ACL) {
//     return value.toJSON();
//   } else if (value instanceof Date) {
//     return { "__type": "Date", "iso": value.toJSON() };
//   } else if (value instanceof GeoPoint) {
//     return value.toJSON();
//   } else if (_.isArray(value)) {
//     return _.map(value, function(x) {
//       return Parse._encode(x, seenObjects, disallowObjects);
//     });
//   } else if (_.isRegExp(value)) {
//     return value.source;
//   } else if (value instanceof Relation) {
//     return value.toJSON();
//   } else if (value instanceof Op) {
//     return value.toJSON();
//   } else if (value instanceof Obj) {
//     var output = {};
//     Parse._each(value, function(v, k) {
//       output[k] = Parse._encode(v, seenObjects, disallowObjects);
//     });
//     return output;
//   } else {
//     return value;
//   }
// };

// /**
//  * The inverse function of Parse._encode.
//  * TODO: make decode not mutate value.
//  */
// Parse._decode = function(key, value) {
//   if (!_.isObject(value)) {
//     return value;
//   } else if (_.isArray(value)) {
//     Parse._each(value, function(v, k) {
//       value[k] = Parse._decode(k, v);
//     });
//     return value;
//   } else if (value instanceof Obj) {
//     return value;
//   } else if (value instanceof Op) {
//     return value;
//   } else if (value.__op) {
//     // Must be a Op.
//     return Op._decode(value);
//   } else if (value.__type === "Pointer") {
//     var pointer = Obj._create(value.className);
//     pointer._finishFetch({ objectId: value.objectId }, false);
//     return pointer;
//   } else if (value.__type === "Object") {
//     // It's an Object included in a query result.
//     var className = value.className;
//     delete value.__type;
//     delete value.className;
//     var object = Obj._create(className);
//     object._finishFetch(value, true);
//     return object;
//   } else if (value.__type === "Date") {
//     return Parse._parseDate(value.iso);
//   } else if (value.__type === "GeoPoint") {
//     return new GeoPoint({
//       latitude: value.latitude,
//       longitude: value.longitude
//     });
//   } else if (key === "ACL") {
//     if (value instanceof ACL) {
//       return value;
//     } else {
//       return new ACL(value);
//     }
//   } else if (value.__type === "Relation") {
//     var relation = new Relation(null, key);
//     relation.targetClassName = value.className;
//     return relation;
//   } else {
//     Parse._each(value, function(v, k) {
//       value[k] = Parse._decode(k, v);
//     });
//    return value;
//   }
// };

/**
 * This is like each, except:
 * * it doesn't work for so-called array-like objects,
 * * it does work for dictionaries with a "length" attribute.
 */
Parse._each = function(obj, callback) {
  if (_.isObject(obj)) {
    each(_.keys(obj), function(key) {
      callback(obj[key], key);
    });
  } else {
    each(obj, callback)
  }
};

// Helper function to check null or undefined.
Parse._isNullOrUndefined = function(x) {
  return _.isNull(x) || _.isUndefined(x)
}

var config = module.config()
if (config) {
  console.log(config)
  Parse.initialize(config.appId, config.jsKey)
}


module.exports = Parse
