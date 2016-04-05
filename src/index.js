"use strict";

const p = require("path"),
    Promise = require("bluebird"),
    RateLimiter = require("limiter").RateLimiter,
    // Limit concurrent requests to 1 in 1/2 second to not hammer GA server
    rateLimiter = Promise.promisifyAll(new RateLimiter(1, 500)),
    MAX_ROWS_PER_REQUEST = 10000;

class GaExtractor {
    constructor(config) {
        this.config = config;
        if (this.config.keyPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            process.env.GOOGLE_APPLICATION_CREDENTIALS = this.config.keyPath;
        } else if (!this.config.keyPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            throw new Error(
                "Must either provide path to Service Account .json key, " +
                "or set path to key in environmental variable GOOGLE_APPLICATION_CREDENTIALS."
            );
        }
        this.google = require("googleapis");
        this.config.proxy && this.google.options({proxy: this.config.proxy});
        this._limitedExtractWithOptions = Promise.promisify(this.google.analytics({
            version: "v3",
            params: {
                "max-results": MAX_ROWS_PER_REQUEST, // always extract everything API will return
                "ids": this.config.profileId ? "ga:" + this.config.profileId : void 0
            }
        }).data.ga.get);
        this._auth = Promise.promisify(
            this.google.auth.getApplicationDefault,
            {context: this.google.auth}
        );
    }

    auth() {
        console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS);
        return this._auth().then((authClient) => {
            if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                authClient = authClient.createScoped(
                    ["https://www.googleapis.com/auth/analytics.readonly"]
                );
            }
            // Set authClient to be used for all future requests
            this.google.options({auth: authClient});
            return authClient.credentials;
        }, function (error) {
            throw new Error(`Auth error; err = ${error.message}`);
        });
    }

    extract(queryObj) {
        return this.auth()
            .then(rateLimiter.removeTokensAsync(1))
            .then(() =>this._limitedExtractWithOptions(queryObj))
            .then((results) => {
                let data = results.rows,
                    runPromise,
                    result;
                if (results.totalResults < MAX_ROWS_PER_REQUEST) {
                    result = data;
                } else {
                    // If totalResults > GA single request limit,
                    // paginate until all data"s extracted
                    const runPromises = [];
                    let runCount = Math.ceil(results.totalResults / MAX_ROWS_PER_REQUEST);
                    queryObj["start-index"] = MAX_ROWS_PER_REQUEST + 1;
                    while (runCount -= 1) {
                        runPromise = this._limitedExtractWithOptions(queryObj)
                            .then((results) => data = data.concat(results.rows));
                        runPromises.push(runPromise);
                        queryObj["start-index"] += MAX_ROWS_PER_REQUEST;
                    }
                    result = Promise.all(runPromises).then(() => data);
                }
                return result;
            })
            .catch(function (err) {
                throw new Error("Extraction error, err = " + err.message);
            });
    }
}

module.exports = GaExtractor;
