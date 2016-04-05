"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var p = require("path"),
    Promise = require("bluebird"),
    RateLimiter = require("limiter").RateLimiter,

// Limit concurrent requests to 1 in 1/2 second to not hammer GA server
rateLimiter = Promise.promisifyAll(new RateLimiter(1, 500)),
    MAX_ROWS_PER_REQUEST = 10000;

var GaExtractor = function () {
    function GaExtractor(config) {
        _classCallCheck(this, GaExtractor);

        this.config = config;
        if (this.config.keyPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = this.config.keyPath;
        } else if (!this.config.keyPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            throw new Error("Must either provide path to Service Account .json key, " + "or set path to key in environmental variable GOOGLE_APPLICATION_CREDENTIALS.");
        }
        this.google = require("googleapis");
        this.config.proxy && this.google.options({ proxy: this.config.proxy });
        this._limitedExtractWithOptions = Promise.promisify(this.google.analytics({
            version: "v3",
            params: {
                "max-results": MAX_ROWS_PER_REQUEST, // always extract everything API will return
                "ids": this.config.profileId ? "ga:" + this.config.profileId : void 0
            }
        }).data.ga.get);
        this._auth = Promise.promisify(this.google.auth.getApplicationDefault, { context: this.google.auth });
    }

    _createClass(GaExtractor, [{
        key: "auth",
        value: function auth() {
            var _this = this;

            console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS);
            return this._auth().then(function (authClient) {
                if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                    authClient = authClient.createScoped(["https://www.googleapis.com/auth/analytics.readonly"]);
                }
                // Set authClient to be used for all future requests
                _this.google.options({ auth: authClient });
                return authClient.credentials;
            }, function (error) {
                throw new Error("Auth error; err = " + error.message);
            });
        }
    }, {
        key: "extract",
        value: function extract(queryObj) {
            var _this2 = this;

            return this.auth().then(rateLimiter.removeTokensAsync(1)).then(function () {
                return _this2._limitedExtractWithOptions(queryObj);
            }).then(function (results) {
                var data = results.rows,
                    runPromise = void 0,
                    result = void 0;
                if (results.totalResults < MAX_ROWS_PER_REQUEST) {
                    result = data;
                } else {
                    // If totalResults > GA single request limit,
                    // paginate until all data"s extracted
                    var runPromises = [];
                    var runCount = Math.ceil(results.totalResults / MAX_ROWS_PER_REQUEST);
                    queryObj["start-index"] = MAX_ROWS_PER_REQUEST + 1;
                    while (runCount -= 1) {
                        runPromise = _this2._limitedExtractWithOptions(queryObj).then(function (results) {
                            return data = data.concat(results.rows);
                        });
                        runPromises.push(runPromise);
                        queryObj["start-index"] += MAX_ROWS_PER_REQUEST;
                    }
                    result = Promise.all(runPromises).then(function () {
                        return data;
                    });
                }
                return result;
            }).catch(function (err) {
                throw new Error("Extraction error, err = " + err.message);
            });
        }
    }]);

    return GaExtractor;
}();

module.exports = GaExtractor;