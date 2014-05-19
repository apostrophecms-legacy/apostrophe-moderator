var async = require('async');
var _ = require('lodash');
var extend = require('extend');
var moment = require('moment');
module.exports = moderator;

function moderator(options, callback) {
  return new moderator.Moderator(options, callback);
}

moderator.Moderator = function(options, callback) {
  var self = this;
  self._apos = options.apos;
  self._app = options.app;
  self._pages = options.pages;
  self._action = '/apos-moderator';
  self._schemas = options.schemas;

  self._apos.mixinModuleAssets(self, 'moderator', __dirname, options);

  // Allow the public to upload media
  self._apos.permissions.addPublic('edit-file');

  self.enhance = function(manager, options) {

    // Add a filter that displays as-yet-unpublished user-submitted content

    var superGet = manager.get;
    manager.get = function(req, userCriteria, options, mainCallback) {
      var filterCriteria = {};
      if (self._apos.sanitizeBoolean(options.pending)) {
        // Show unpublished user submissions
        filterCriteria.published = { $ne: true };
        filterCriteria.submission = true;
        userCriteria = { $and: [ userCriteria, filterCriteria ] };
      }
      return superGet(req, userCriteria, options, mainCallback);
    };

    // If manager.afterAcceptance exists, call it after first publication
    // of a particular submitted item. If manager.afterRejection exists,
    // call it when a particular submitted item that has never been
    // published is moved to the trash.

    var superBeforePutOne = manager.beforePutOne;
    manager.beforePutOne = function(req, slug, options, snippet, callback) {
      var firstPublication;
      if (snippet.published && (!snippet.publishedOnce)) {
        snippet.publishedOnce = true;
        firstPublication = true;
      }
      return async.series({
        afterAcceptance: function(callback) {
          if (snippet.submission && firstPublication && manager.afterAcceptance) {
            return manager.afterAcceptance(req, snippet, callback);
          }
          return callback(null);
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        return superBeforePutOne(req, slug, options, snippet, callback);
      });
    };

    var superBeforeTrash = manager.beforeTrash;
    manager.beforeTrash = function(req, snippet, trash, callback) {
      return async.series({
        afterRejection: function(callback) {
          if (snippet.submission && (!snippet.publishedOnce) && trash && manager.afterRejection) {
            return manager.afterRejection(req, snippet, callback);
          } else {
            return callback(null);
          }
        }
      }, function(err) {
        if (err) {
          return callback(err);
        }
        // Does not always exist (TODO: in 0.5 fix that for convenience)
        if (superBeforeTrash) {
          return superBeforeTrash(req, trash, snippet, callback);
        }
        return callback(null);
      });
    };

    // Make sure that in any situation where the user is able to edit
    // an existing piece, that piece is marked with the "submission" flag
    // so we can find it via the moderation filter later. This takes care
    // of edits made via "new" or "edit" by a user who has an account and
    // the ability to edit their work but not the privilege of directly
    // publishing it
    var superPublishBlocked = manager.publishBlocked;
    manager.publishBlocked = function(piece) {
      piece.submission = true;
    };

    self._app.all(self._action + '/' + manager._instance + '/submit', function(req, res) {
      // Allows use of addFields, removeFields, etc. Otherwise the
      // user can edit everything which does not make much sense

      // In no case should the public be able to pre-publish their work
      // or set a slug. I'm tempted to ban tags, but that could be useful,
      // so I leave it up to the developer to remove it if they want to
      options.removeFields = (options.removeFields || []).concat([ 'published', 'slug' ]);
      var subsetFields = self._schemas.refine(manager.schema, options);

      var piece = manager.newInstance();
      // published is often set to true by default for snippets created
      // by other means, we need to make sure it doesn't sneak by here
      delete piece.published;

      if (req.method === 'POST') {
        return async.series({
          convert: function(callback) {
            self._schemas.convertFields(req, subsetFields, 'form', req.body, piece, callback);
          },
          // Make sure they will be able to edit it someday
          authorAsEditor: function(callback) {
            piece.slug = self._apos.slugify(piece.title);
            piece.submission = true;
            piece.authorId = ((req.user && req.user._id) || 'anon');
            manager.authorAsEditor(req, piece);
            return callback(null);
          },
          put: function(callback) {
            // Shut off permissions for this call so the public can
            // submit unpublished content
            return manager.putOne(req, piece.slug, { permissions: false }, piece, callback);
          },
          notify: function(callback) {
            if (!manager.afterSubmission) {
              return callback(null);
            }
            return manager.afterSubmission(req, piece, callback);
          }
        }, function(err) {
          res.send({ status: err ? 'error' : 'ok' });
        });
      } else {
        return res.send({ status: 'ok', piece: piece, fields: subsetFields, template: manager.render('submissionEditor', { fields: subsetFields }) });
      }
    });
  };

  _.each(options.types, function(options, type) {
    self.enhance(self._pages.getManager(type), options);
  });

  // Anons are potentially allowed to submit content for moderation (that is
  // pretty much the entire point)
  self.pushAsset('script', 'content', { when: 'always' });

  // Construct our browser side object
  var browserOptions = {};
  extend(true, browserOptions, options.browser || {});
  _.defaults(browserOptions, {
    action: self._action,
    types: options.types
  });

  // The option can't be .constructor because that has a special meaning
  // in a javascript object (not the one you'd expect, either) http://stackoverflow.com/questions/4012998/what-it-the-significance-of-the-javascript-constructor-property
  var browser = {
    construct: browserOptions.construct || 'AposModerator'
  };

  self._apos.pushGlobalCallWhen('always', 'window.aposModerator = new @(?)', browser.construct, browserOptions);

  return process.nextTick(function() {
    return callback(null);
  });
};

