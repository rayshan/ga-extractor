(function() {
  var GaExtractor, Promise, RateLimiter, gaMaxRowsPerRequest, gaRateLimiter, gp12, p;

  p = require('path');

  Promise = require('bluebird');

  RateLimiter = require('limiter').RateLimiter;

  gaRateLimiter = Promise.promisifyAll(new RateLimiter(1, 500));

  gp12 = Promise.promisify(require('google-p12-pem'));

  gaMaxRowsPerRequest = 10000;

  GaExtractor = (function() {
    function GaExtractor(config) {
      this.config = config;
      if (!this.config.clientEmail) {
        throw new Error("clientEmail is required.");
      }
      if (!this.config.keyPath && !this.config.keyContent) {
        throw new Error("Must provide either path to Service Account .pem key file, or key's content as string.");
      }
      this.gApi = require("googleapis");
      this.ga = Promise.promisifyAll(this.gApi.analytics({
        version: 'v3',
        params: {
          "max-results": gaMaxRowsPerRequest,
          'ids': this.config.profileId ? 'ga:' + this.config.profileId : void 0
        },
        proxy: this.config.proxy
      }).data.ga);
      return;
    }

    GaExtractor.prototype.auth = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          var _convertKey;
          _convertKey = new Promise(function(_resolve) {
            if (_this.config.keyPath) {
              return _resolve(gp12(_this.config.keyPath));
            } else {
              return _resolve(null);
            }
          });
          return _convertKey.then(function(keyContent) {
            var _authClient;
            _authClient = new _this.gApi.auth.JWT(_this.config.clientEmail, null, keyContent, "https://www.googleapis.com/auth/analytics.readonly", _this.impersonatedUser);
            _authClient.authorize(function(err, token) {
              if (err) {
                return reject(new Error("OAuth error; err = " + err.error));
              } else {
                return resolve(token);
              }
            });
            return _this.gApi.options({
              auth: _authClient
            });
          });
        };
      })(this));
    };

    GaExtractor.prototype.extract = function(queryObj) {
      return this.auth().delay(500).bind(this).then(gaRateLimiter.removeTokensAsync(1)).then(function() {
        return this.ga.getAsync(queryObj).get(0);
      }).then(function(results) {
        var data, runPromise, runPromises, runs;
        data = results.rows;
        if (!(results.totalResults > gaMaxRowsPerRequest)) {
          return data;
        }
        runPromises = [];
        runs = Math.ceil(results.totalResults / gaMaxRowsPerRequest);
        queryObj["start-index"] = gaMaxRowsPerRequest + 1;
        while (runs -= 1) {
          runPromise = this.ga.getAsync(queryObj).get(0).then(function(results) {
            data = data.concat(results.rows);
          });
          runPromises.push(runPromise);
          queryObj["start-index"] += gaMaxRowsPerRequest;
        }
        return Promise.all(runPromises).then(function() {
          return data;
        });
      })["catch"](function(err) {
        throw new Error("Extraction error, err = " + err.message);
      });
    };

    return GaExtractor;

  })();

  module.exports = GaExtractor;

}).call(this);
