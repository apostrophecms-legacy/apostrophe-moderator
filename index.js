var async = require('async');
var _ = require('underscore');
var extend = require('extend');
var snippets = require('apostrophe-snippets');
var moment = require('moment');

module.exports = moderator;

function moderator(options, callback) {
  return new moderator.Moderator(options, callback);
}

moderator.Moderator = function(options, callback) {
  var self = this;
  var moderatedTypes = {};

  self.modules = {};

  console.log('Hi. I am a moderator.');

  self.setBridge = function(modules) {
    self._bridge = modules
    for(t in options.types) {
      var type = options.types[t];
      moderatedTypes[type] = self._bridge['apostrophe-'+type];
      self.modules = moderatedTypes;
    }
  };

  self.intercept = function(callback) {
    // Loop through the types passed in in the options
    // and attach moderator 
    for(t in moderatedTypes) {
      var type = self.modules[t];

      // attach new functions to the class as such:
      // type.myNewFunction = function(req, callback) {
      //   console.log('blah blah blah');
      //   return callback(null);
      // }

      // TODO:
      // - override module's schema to include an approved flag 
      // - override module.get to exclude items that have 'approved' set to false
      // - expose routes that the public can post un approved instances of the class to mongo
      // - include unapproved items in another tab in the 'manage' view of module   

      // Override the dispatch methods like so
      // (superDispatch is often already defined so we are using
      // dispatch to cache the original dispatch method)
      type.ultraDispatch = type.dispatch;

      type.dispatch = function(req, callback) {
        //put your other stuff in here
        console.log('HIJACKING YOUR MODULE');
        return this.ultraDispatch(req, callback);
      }
    }

    callback(null);
 }

  return process.nextTick(function() {
    return callback(null);
  });
}