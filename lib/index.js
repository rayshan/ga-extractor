(function() {
  var GaExtractor, Promise, RateLimiter, gaMaxRowsPerRequest, gaRateLimiter, p, readFileAsync;

  p = require('path');

  Promise = require('bluebird');

  RateLimiter = require('limiter').RateLimiter;

  readFileAsync = Promise.promisify(require("fs").readFile);

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
      this.init = function() {
        return readFileAsync(this.config.keyPath, 'utf-8').bind(this).then(function(keyContent) {
          return new this.gApi.auth.JWT(this.config.clientEmail, null, this.config.keyContent ? this.config.keyContent : keyContent, "https://www.googleapis.com/auth/analytics.readonly", this.impersonatedUser);
        });
      };
      return;
    }

    GaExtractor.prototype.auth = function() {
      return new Promise((function(_this) {
        return function(resolve, reject) {
          return _this.init().bind(_this).then(function(authClient) {
            return authClient.authorize((function(_this) {
              return function(err, token) {
                if (err) {
                  return reject(new Error("OAuth error; err = " + err.message));
                } else {
                  _this.gApi.options({
                    auth: authClient
                  });
                  return resolve(token);
                }
              };
            })(this));
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
