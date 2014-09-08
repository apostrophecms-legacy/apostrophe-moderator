function AposModerator(options) {
  var self = this;
  self._action = options.action;
  // This button means "I would like to submit an article, please open
  // the modal so I can do that." It's easily confused with a "submit"
  // button in the usual sense in a form.
  $('body').on('click', '[data-moderator-submit-button]', function() {
    // Make sure we have access to the functionality of apostrophe-schemas,
    // user.js in the apostrophe module, etc.
    var instance = $(this).attr('data-moderator-submit-button');
    apos.requireScene('user', function() {
      var url = self._action + '/' + instance + '/submit';
      $.getJSON(url, function(data) {
        if (data.status !== 'ok') {
          alert('A server error occurred.');
          return;
        }
        var piece = data.piece;
        var fields = data.fields;
        var $piece = $(data.template);
        // bc with existing submissionEditor.html code which assumes apos-template
        // is needed for these. Without this fix selectize avoids the modal because
        // it thinks it's messing with a template
        $piece.removeClass('apos-template');
        apos.modal($piece, {
          init: function(callback) {
            return aposSchemas.populateFields($piece, fields, piece, callback);
          },
          save: function(callback) {
            return aposSchemas.convertFields($piece, fields, piece, function(err) {
              if (err) {
                // Balk on an error such as "required"
                aposSchemas.scrollToError($piece);
                return;
              }
              var manager = aposPages.getManager(instance);
              var customValidate;
              if (manager) {
                customValidate = manager._validate;
              } else {
                customValidate = function($el, data, action, callback) {
                  return callback(null);
                };
              }
              return customValidate($piece, piece, 'insert', function(err) {
                if (err) {
                  // Balk on a custom error
                  aposSchemas.scrollToError($piece);
                  return;
                }
                $.jsonCall(url, piece, function(result) {
                  if (result.status !== 'ok') {
                    alert('An error occurred. Please try again.');
                    return callback('error');
                  }
                  alert('Thank you for your submission! It will be reviewed before it appears on the site.');
                  return callback(null);
                });
              });
            });
          }
        });
      });
    });
    return false;
  });

  // Returns true if the current user should be allowed to publish the
  // specified instance type (not just submit it).
  //
  // TODO: this duplicates logic that exists on the server. Think about pushing
  // this knowledge to the browser as a predefined array. Also see the notes
  // below - the whole business of adjusting this browser side rather than
  // custom rendering it for different audiences server side is questionable

  self.canPublish = function(type) {
    if (!apos.data.user) {
      return false;
    }
    if (apos.data.permissions.admin) {
      return true;
    }
    if (apos.data.permissions.edit) {
      return true;
    }
    if (apos.data.permissions['admin-' + apos.cssName(type)]) {
      return true;
    }
    if (apos.data.permissions['edit-' + apos.cssName(type)]) {
      return true;
    }
    return false;
  };

  // Users with real accounts may also be able to use the "Manage Events" and
  // "New Events" options, as well as editing existing events (to take events as
  // an example). On the server side we make sure they can't publish anything,
  // and that anything they do edit becomes unpublished and marked for
  // moderation. On the browser side, pull the published field out of the form
  // to avoid confusion

  // Use afterYield to ensure all the type managers have been fully initialized

  // TODO: it would be better to render new.html and edit.html differently for
  // unprivileged users on the server side every time, taking into account
  // a suitable schema subset. Except, we don't want them to accidentally trash
  // anything that admins did. Hmm.

  apos.afterYield(function() {
    // Don't crash when there is no one logged in
    if (apos.scene !== 'user') {
      return;
    }
    _.each(options.types, function(options, type) {
      if (!self.canPublish(type)) {
        var manager = aposPages.getManager(type);
        var superAfterPopulatingEditor = manager.afterPopulatingEditor;
        manager.afterPopulatingEditor = function($el, snippet, callback) {
          return superAfterPopulatingEditor($el, snippet, function(err) {
            if (err) {
              return callback(err);
            }
            $el.find('[data-name="published"]').remove();
            return callback(null);
          });
        };
      }
    });
  });
}
