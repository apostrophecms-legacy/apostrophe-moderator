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
  var moderatedTypes = [];

  self.setBridge = function(modules) {
    self._bridge = modules;

    for(t in options.types) {
      var type = options.types[t];
      moderatedTypes.push('apostrophe-'+type);
    }
  };

  self.intercept = function(callback) {
    self._apos = self._bridge[moderatedTypes[0]]._apos;
    self._apos.pushAsset('template', 'manage', __dirname, '');

    // self._apos.addLocal('aposModeratorMenu', function(args) {
    //   self._apos.partial('menu', args, _.map(self._bridge, function(module) { return __dirname + '/views'; }
    // });

    // Loop through the types passed in in the options
    // and attach moderator 
    async.each(moderatedTypes, function(_type, callback){
      var type = self._bridge[_type];
      self.overrideModule(type, callback);
    }, function(){
      callback(null);
    });
  }

 self.overrideModule = function(type, callback) {
  type.ultraDispatch = type.dispatch;
  type.dispatch = function(req, callback) {
    if(req.remainder == '/submit') {
      req.template = type.renderer('submissionForm');
      return callback(null);
    }

    return type.ultraDispatch(req, callback);
  }

  type.options = {};

  type.superGet = type.get;
  type.get = function(req, userCriteria, optionsArg, callback) {
    // adding mandatory criteria prevents anything having to do with the approval queue
    // from making its way into normal snippet requests
    var mandatoryCriteria = { approved: { $exists: false }};
    for(c in userCriteria) { mandatoryCriteria[c] = userCriteria[c] }
    type.superGet(req, mandatoryCriteria, optionsArg, callback);
  };


  type.addExtraRoutes = function() {
    type._app.post(type._action +'/submit', function(req, res) {
      var snippet;
      var title;
      var thumbnail;
      var content;
      var slug;
      var published = false;

      title = req.body.title.trim();
      if (!title.length) {
        title = type.getDefaultTitle();
      }
      slug = type._apos.slugify(title);
      tags = type._apos.sanitizeTags(req.body.tags);

      snippet = { 
        title: title, 
        published: published,
        type: type._instance,
        approved: false,
        tags: tags, 
        areas: {}, 
        slug: slug, 
        createdAt: new Date(), 
        publishedAt: new Date()
      };

      snippet.sortTitle = type._apos.sortify(snippet.title);
      type.convertAllFields('form', req.body, snippet);

      var newSnippet = snippet;

      type.getOne(req, {}, {}, function(err, result){
        delete result._id;
        delete result.publishedAt;
        delete result.published;
        delete result.searchSummary;
        delete result.lowSearchText;
        delete result.highSearchText;
        delete result.slug;

        for(field in result) {
          if(req.body[field] && !snippet[field]) {
            snippet[field] = req.body[field]
          }
        }

        async.series([ permissions, beforeInsert, beforeSave, insert, afterInsert, afterSave ], function(){
          res.send('/')              
        });

        function permissions(callback) {
          type._apos.permissions(req, 'edit-' + type._css, null, callback);
        }

        function beforeInsert(callback) {
          type.authorAsEditor(req, snippet);
          return type.beforeInsert(req, req.body, snippet, callback);
        }

        function beforeSave(callback) {
          return type.beforeSave(req, req.body, snippet, callback);
        }

        function insert(callback) {
          return type.putOne(req, slug, snippet, callback);
        }

        function afterInsert(callback) {
          return type.afterInsert(req, req.body, snippet, callback);
        }

        function afterSave(callback) {
          return type.afterSave(req, req.body, snippet, callback);
        }
      });
    });
  }
  type.addExtraRoutes();
  callback();
 }

  return process.nextTick(function() {
    return callback(null);
  });
}