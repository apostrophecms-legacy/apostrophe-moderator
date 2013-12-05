var async = require('async');
var _ = require('underscore');
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

    self._app.all(self._action + '/' + manager._instance + '/submit', function(req, res) {
      // Allows use of addFields, removeFields, etc. Otherwise the
      // user can edit everything which does not make much sense

      // In no case should the public be able to pre-publish their work
      // or set a slug. I'm tempted to ban tags, but that could be useful,
      // so I leave it up to the developer to remove it if they want to
      options.removeFields = (options.removeFields || []).concat([ 'published', 'slug' ]);
      var subsetFields = self._schemas.refine(manager.schema, options);

      var piece = manager.newInstance();

      if (req.method === 'POST') {
        self._schemas.convertFields(subsetFields, 'form', req.body, piece);
        piece.slug = self._apos.slugify(piece.title);
        piece.submission = true;
        return async.series({
          put: function(callback) {
            // Shut off permissions for this call so the public can
            // submit unpublished content
            return manager.putOne(req, piece.slug, { permissions: false }, piece, callback);
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
  // sort of the point)
  self.pushAsset('script', 'content', { when: 'always' });

  // Construct our browser side object REFACTOR
  var browserOptions = options.browser || {};

  // The option can't be .constructor because that has a special meaning
  // in a javascript object (not the one you'd expect, either) http://stackoverflow.com/questions/4012998/what-it-the-significance-of-the-javascript-constructor-property
  var browser = {
    construct: browserOptions.construct || 'AposModerator'
  };

  self._apos.pushGlobalCallWhen('always', 'window.aposModerator = new @(?)', browser.construct, { action: self._action });
  self.serveAssets();

  return process.nextTick(function() {
    return callback(null);
  });
};

