(function() {
  var GaExtractor, Promise, RateLimiter, gaMaxRowsPerRequest, gaRateLimiter, p;

  p = require('path');

  Promise = require('bluebird');

  RateLimiter = require('limiter').RateLimiter;

  gaRateLimiter = Promise.promisifyAll(new RateLimiter(1, 500));

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
        }
      }).data.ga);
      this.authClient = new this.gApi.auth.JWT(this.config.clientEmail, this.config.keyPath, this.config.keyContent, "https://www.googleapis.com/auth/analytics.readonly", this.impersonatedUser);
      return;
    }

    GaExtractor.prototype.auth = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          _this.authClient.authorize(function(err, token) {
            if (err) {
              reject(new Error("OAuth error; err = " + err.error));
            } else {
              resolve(token);
            }
          });
          _this.gApi.options({
            auth: _this.authClient
          });
        };
      })(this));
    };

    GaExtractor.prototype.extract = function(queryObj) {
      return this.auth().bind(this).delay(500).then(gaRateLimiter.removeTokensAsync(1)).then(function() {
        return this.ga.getAsync(queryObj).get(0).bind(this).then(function(data) {
          var results, runPromise, runPromises, runs;
          results = data.rows;
          if (!(data.totalResults > gaMaxRowsPerRequest)) {
            return results;
          }
          runPromises = [];
          runs = Math.ceil(data.totalResults / gaMaxRowsPerRequest);
          queryObj["start-index"] = gaMaxRowsPerRequest + 1;
          while (runs -= 1) {
            runPromise = this.ga.getAsync(queryObj).get(0).then(function(data) {
              results = results.concat(data.rows);
            });
            runPromises.push(runPromise);
            queryObj["start-index"] += gaMaxRowsPerRequest;
          }
          return Promise.all(runPromises).then(function() {
            return results;
          });
        });
      })["catch"](function(err) {
        throw new Error("Extraction error, err = " + err.message);
      });
    };

    return GaExtractor;

  })();

  module.exports = GaExtractor;

}).call(this);
