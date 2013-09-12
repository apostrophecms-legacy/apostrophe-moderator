apostrophe-moderator
====================

This component creates a public-facing interface that allows users to submit instances of existing apostrophe classes to the site's database.

##Usage

In your apostrophe-site configuration, include apostrophe-moderator. Pass it an array of types to be moderated.

```
  modules: {
    'apostrophe-blog':      { },
    'apostrophe-events':    { },
    'apostrophe-map':       { },
    'apostrophe-moderator': {
      // Define the snippets-style modules that will be intercepted by apostrophe-moderator.
      // Note that I have left out the 'apostrophe-' prefix. This is added automatically.
      'types': ['events', 'map']
    }, 
  },
```