
(function(root) {
  root.Parse = root.Parse || {};
  var Parse = root.Parse;
  var _ = Parse._;

  /**
   * 
   *
   * @namespace Contains functions for calling and declaring
   * <a href="/docs/cloud_code_guide#functions">cloud functions</a>.
   * <p><strong><em>
   *   Some functions are only available from Cloud Code.
   * </em></strong></p>
   */
  Parse.Cloud = {
    /**
     * Makes a call to a cloud function.
     * @param {String} name The function name.
     * @param {Object} data The parameters to send to the cloud function.
     * @param {Object} options A Backbone-style options object
     * options.success, if set, should be a function to handle a successful
     * call to a cloud function.  options.error should be a function that
     * handles an error running the cloud function.  Both functions are
     * optional.  Both functions take a single argument.
     */
    run: function(name, data, options) {
      var oldOptions = options;
      var newOptions = _.clone(options);
      newOptions.success = function(resp) {
        var results = Parse._decode(null, resp);
        if (oldOptions.success) {
          oldOptions.success(results.result);
        }
      };

      newOptions.error = Parse.Cloud._wrapError(oldOptions.error, options);
      Parse._request("functions",
                     name,
                     null,
                     'POST',
                     Parse._encode(data, null, true),
                     newOptions);
    },

    _wrapError: function(onError, options) {
      return function(response) {
        if (onError) {
          var error = new Parse.Error(-1, response.responseText);
          if (response.responseText) {
            var errorJSON = JSON.parse(response.responseText);
            if (errorJSON) {
              error = new Parse.Error(errorJSON.code, errorJSON.error);
            }
          }
          onError(error, options);
        }
      };
    }
  };
}(this));

