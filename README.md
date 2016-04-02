# ga-extractor [![Build Status](https://travis-ci.org/rayshan/ga-extractor.svg?branch=master)](https://travis-ci.org/rayshan/ga-extractor)

> Free your Google Analytics data.

`ga-extractor` bulk-extracts Google Analytics (GA) raw data using the [Core Reporting API](https://developers.google.com/analytics/devguides/reporting/core/v3/). Use it as part of your [ETL](http://en.wikipedia.org/wiki/Extract,_transform,_load) process.

`ga-extractor` was spun off from [`bower-server-etl`](https://github.com/rayshan/bower-server-etl), the ETL service that feeds [Bower](http://bower.io/)'s registry.


## Features

- Compatible with latest GA Core Reporting API `v3`
- Authorizes using OAuth 2.0 [Service Accounts](https://developers.google.com/accounts/docs/OAuth2ServiceAccount)
- Promises
- Will break large extractions into smaller queries based on GA's single query [limit](https://developers.google.com/analytics/devguides/reporting/core/v3/limits-quotas#core_reporting)
- Well tested against live GA API server


## Install

```sh
npm install --save ga-extractor
```


## Usage

Sign up for a GA [Service Account](https://developers.google.com/accounts/docs/OAuth2ServiceAccount), download your `.p12` private key.

```js
var gaExtractor = require('ga-extractor');

var options = {
  clientEmail: "x@developer.gserviceaccount.com",
  // need either keyPath or keyContent
  keyPath: "test/fixtures/xxx.p12",
  keyContent: "Bag Attributes...",
  // below are optional
  profileId: "xxxxxxxx", // define once here or define a different one in every queryObj
  impersonatedUser: "steve@apple.com"
  proxy: "http://proxy.example.com"
};

var gaExtractor = new GaExtractor(options);

// To build your query, see
// https://developers.google.com/analytics/devguides/reporting/core/v3/reference#q_summary
// and https://developers.google.com/analytics/devguides/reporting/core/v3/reference
var queryObj = {
  'start-date': '31daysAgo',
  'end-date': 'yesterday',
  'metrics': 'ga:users',
  'dimensions': 'ga:country'
  // no need to define 'max-results', always extracts all data
};

gaExtractor.extract(queryObj)
  .then(function (data) {
    // do something with data returned, e.g. transform & load into database
    data = [
      ["United States", "5471"],
      ["United Kingdom", "1084"],
      ["France", "801"]
      // ...
    ];
  })
  .catch(console.error);
```

To try your query without writing any code, use the [Query Explorer Tool](https://ga-dev-tools.appspot.com/explorer/).

Example of original data returned by GA API:

```json
{
  "kind": "analytics#gaData",
  "id": "...",
  "query": {
    "start-date": "7daysAgo",
    "end-date": "yesterday",
    "ids": "...",
    "dimensions": "ga:country",
    "metrics": ["ga:users"],
    "sort": ["-ga:users"],
    "start-index": 1,
    "max-results": 10000
  },
  "itemsPerPage": 10000,
  "totalResults": 137,
  "selfLink": "...",
  "profileInfo": {
    "profileId": "...",
    "accountId": "...",
    "webPropertyId": "...",
    "internalWebPropertyId": "...",
    "profileName": "...",
    "tableId": "..."
  },
  "containsSampledData": false,
  "columnHeaders": [],
  "totalsForAllResults": {
    "ga:users": "17205"
  },
  "rows": [
    ["United States", "5471"],
    ["United Kingdom", "1084"],
    ["France", "801"]
  ]
}
```

`.extract` returns only the content of `rows` object above.


## Contribution

Install dependencies: `npm install`

Ensure tests pass: `npm test`

TODO: all tests are integration tests and execute against live GA API server. Docs on fixtures needed for testing coming soon. In the mean time you can submit a PR and owner will manually test.

Build .js for distribution: `npm build`


## License

MIT © [Ray Shan](shan.io)
