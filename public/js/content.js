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
        apos.modal($piece, {
          init: function(callback) {
            return aposSchemas.populateFields($piece, fields, piece, callback);
          },
          save: function(callback) {
            return aposSchemas.convertFields($piece, fields, piece, function() {
              $.jsonCall(url, piece, function(result) {
                if (result.status !== 'ok') {
                  alert('An error occurred. Please try again.');
                  return callback('error');
                }
                alert('Thank you for your submission! It will be reviewed before it appears on the site.');
                return callback(null);
              });
            });
          }
        });
      });
    });
    return false;
  });
}
