apostrophe-moderator
====================

This component creates a public-facing interface that allows users to submit instances of existing apostrophe classes to the site's database.

## Code Status

This module now has a reasonably complete feature set and is on track to be used in production on our own sites.

## TODO

* The provided filter for locating newly submitted material in the "manage" modal dialogs is effective, but we would prefer to build a classy modal dedicated to moderation which displays a normal view of each article, and consider making the approval process a little slicker than the current routine of clicking "pending," clicking to edit each item, switching "published" to "yes" and clicking "save."

## Configuration

In your apostrophe-site configuration, include apostrophe-moderator. Pass it an array of instance types to be moderated. Be sure to specify the permitted fields, otherwise users are presented with all the possible fields which in most cases would include things like `published` that you do not want them to control.

You may use `addFields`, `orderFields` and `removeFields` exactly as you would when extending the schema of any type in app.js. Adding a field might not make sense, but you can use `addFields` to override the definition of a field by name. In order to present fewer widget choices for the `body`, for instance.

The `slug` and `published` fields are always suppressed from user submitted content forms.

See the `apostrophe-schemas` module for more information on the use of these options.

```
  types: {
    'event': {
      removeFields: [ 'thumbnail' ],
      addFields: [
        {
          name: 'body',
          label: 'Body',
          type: 'area',
          options: {
            textOnly: true
          }
        }
      ]
    }
  }
```

Note that eliminating the thumbnail and using the `textOnly` option is only an example. Guests may submit and manage media for use in their own content if you want to let them.

## Adding Submission Buttons To Your Site

```html
<a href="#" data-moderator-submit-button="event">Submit Your Event</a>
```

Easy, no?

Just make sure the element has the `data-moderator-submit-button` attribute, and the value is the instance type (like "event") to be submitted.

## Adding Submission Forms

For submissions to work you must have a `submissionEditor.html` template in the `views` folder for the appropriate module.

For instance, this could be the content of `lib/modules/events/views/submissionEditor.html`:

```jinja
{% include 'schemas:schemaMacros.html' %}
<div class="apos-modal apos-template">
  <h3>My Event</h3>
  {% block topButtons %}
  {% endblock %}
  <div class="apos-modal-body">
    <form>
      {{ schemaFields(fields) }}
    </form>
  </div>
  <div class="apos-modal-footer">
    <div class="apos-modal-footer-buttons">
      <a href="#" data-action="dismiss" class="apos-control apos-button apos-cancel">Cancel</a>
      <a href="#" class="apos-control apos-button apos-save">Submit My Event</a>
    </div>
  </div>
</div>
```

Note the use of `schemaFields` to render all the fields in the form without a fuss. You can customize the way fields are output; see the [apostrophe-schemas](apostrophe-schemas) module documentation.

## Approving Submitted Content

All submitted content is initially unpublished. In order for admins to effectively moderate incoming content, you will need to override the `manage.html` template of the module in question and add a call to `snippetModerationFilter()`. You'll put your override in `lib/modules/apostrophe-events/views/manage.html`, as usual when overriding templates in Apostrophe.

This allows admins to click "Pending" to see just the as-yet-unapproved content. Then admins can edit those items and set "Published" to "Yes."

Be sure to include the appropriate macros file first in `manage.html`, like this:

```jinja
{% include 'snippetMacros.html' %}
{% include 'moderator:moderatorMacros.html' %}

<div class="apos-modal apos-template {{ manageClass }}">
  <h3>{% block action %}Manage {{ label | e }}{% endblock %}</h3>
  <div class="apos-modal-body">
    <a href="#" class="apos-control apos-button apos-new-button apos-new-snippet-button" {{ newButtonData }}>New {{ instanceLabel | e }}</a>
    <div class="apos-modal-filters">
      {{ snippetTrashFilter() }}
      {{ snippetPublishedFilter() }}
      {{ snippetDateFilter() }}
      {{ snippetModerationFilter() }}
      {{ snippetSearchFilter() }}
    </div>

    <table data-items class="apos-manage-table">
      <tr>
        <th class="apos-manage-events-date">Date</th>
        <th class="apos-manage-events-title">Title</th>
        <th class="apos-manage-events-author">Author</th>
        <th class="apos-manage-events-status">Status</th>
      </tr>
      <tr class="apos-template" data-item>
        <td>
          <span data-date></span>
        </td>
        <td>
          <span><a href="#" {{ editButtonData }} data-title>Sample Title</a></span>
        </td>
        <td></td>
        <td>
          <span data-status></span>
        </td>
      </tr>
    </table>

    {# Container for pager, which gets rendered here by js #}
    <div data-pager-box></div>
  </div>
  <div class="apos-modal-footer">
    <a href="#" data-action="dismiss" class="apos-control apos-button apos-cancel">Done</a>
  </div>
</div>
```

Again, admins can now select "All" to see all events, or "Pending" to see user-submitted events that are not yet published.

To publish an event an admin simply marks it published.

... And that's it! Your site now supports user-submitted content. Enjoy.

## Validation

The `required` option, and any other validation options supported by `apostrophe-schemas`, are supported by `apostrophe-moderator`.

If you need more than that, [implement a `validate` callback in your browser-side snippet subclass](https://github.com/punkave/apostrophe-snippets#sending-extra-properties-to-the-server-subclassing-on-the-browser-side). Your `validate` callback will be fired with the `insert` action just as it would be when an administrator creates a new snippet.

## Notifications

Sometimes you'll want to do something special when a submission is received, published, or rejected (moved to the trash without ever having been published).

This is easy to do! The module for the content you're moderating just has to include appropriate methods, and apostrophe-moderator will automatically call them.

Here is an example of a `lib/modules/apostrophe-events/index.js` file that sends email when these events happen:

```javascript
module.exports = events;

function events(options, callback) {
  return new events.Events(options, callback);
}

events.Events = function(options, callback) {
  var self = this;

  module.exports.Super.call(this, options, null);

  self._apos.mixinModuleEmail(self);

  self.afterRejection = function(req, snippet, callback) {
    return sendAuthorNotice(req, snippet, 'Your event submission has been rejected', 'rejected', callback);
  };

  self.afterAcceptance = function(req, snippet, callback) {
    return sendAuthorNotice(req, snippet, 'Your event submission has been accepted for publication!', 'accepted', callback);
  };

  self.afterSubmission = function(req, snippet, callback) {
    return sendAuthorNotice(req, snippet, 'Your event submission has been received for review', 'submitted', callback);
  };

  function sendAuthorNotice(req, snippet, subject, template, callback) {
    // bypass permissions so we're allowed to fetch them even if they are unpublished
    return self._pages.getManager('person').getOne(req, { _id: snippet.authorId }, { permissions: false }, function(err, author) {
      if (err) {
        console.error('error getting author for notice, nonfatal');
        return callback(null);
      }
      if (!author) {
        // No author, again, not fatal
        console.error('no author for notice');
        return callback(null);
      }
      return self.email(req, author,
        subject, template,
        { event: snippet }, callback);
    });
  }

  // Must wait at least until next tick to invoke callback!
  if (callback) {
    process.nextTick(function() { return callback(null); });
  }

};
```

The tricky bit is getting hold of the original author's name and email address so you know where to send the email. If you are requiring people to log in before submitting content, you can take advantage of `authorId`, a property that `apostrophe-moderator` adds to each submission, to fetch the appropriate person object as shown above. If you are not requiring logins, then you'll need to make sure that full name and email address fields are part of the schema for each submission, and just use those:

```javascript
return self.email(req, { fullName: snippet.contactName, email: snippet.contactEmail }, ...)
```

Note the use of `mixinModuleEmail` to make the `self.email` method available:

```javascript
  // Initialize the superclass...
  module.exports.Super.call(this, options, null);

  // Now we can mix in email
  self._apos.mixinModuleEmail(self);
```

Email message templates named `rejection.html` and `rejection.txt` must exist in `lib/modules/apostrophe-events/views`, and likewise for `accepted` and `submitted`.

