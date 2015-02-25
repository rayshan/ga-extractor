# Vendor
p = require 'path'
Promise = require 'bluebird'
RateLimiter = require('limiter').RateLimiter
# promisify for better control flow
# limit # of concurrent requests to 1 in 1/2 sec to not hammer GA server
gaRateLimiter = Promise.promisifyAll new RateLimiter 1, 500
gp12 = Promise.promisify require 'google-p12-pem'
gApi = require "googleapis"

# ==========

gaMaxRowsPerRequest = 10000

class GaExtractor
  constructor: (@config) ->
    throw new Error "clientEmail is required." if !@config.clientEmail
    if !@config.keyPath and !@config.keyContent
      throw new Error "Must provide either path to Service Account .pem key file, or key's content as string."

    @ga = Promise.promisifyAll gApi.analytics({
      version: 'v3'
      params:
        "max-results": gaMaxRowsPerRequest # always extract everything API will return
        'ids': ('ga:' + @config.profileId) if @config.profileId
      proxy: @config.proxy
    }).data.ga

    return

  auth: -> new Promise (resolve, reject) =>
    # convert .p12 key to .pem
    _convertKey = new Promise (_resolve) =>
      if @config.keyPath
        _resolve gp12 @config.keyPath
      else
        _resolve @config.keyContent

    _convertKey.then (keyContent) =>
      _authClient = new gApi.auth.JWT(
        @config.clientEmail
        null
        keyContent
        "https://www.googleapis.com/auth/analytics.readonly" # scope uri
        @impersonatedUser
      )

      _authClient.authorize (err, token) =>
        # returns .expiry_date in 1 hr
        if err
          reject new Error "OAuth error; err = #{ err.error }"
        else
          resolve token
      gApi.options auth: _authClient

  extract: (queryObj) ->
    @auth().delay 500
      .bind @
      .then gaRateLimiter.removeTokensAsync 1
      .then -> @ga.getAsync(queryObj).get 0 # [1] is whole object returned by request again
      .then (results) ->
        data = results.rows
        return data unless results.totalResults > gaMaxRowsPerRequest

        # if totalResults > GA single request limit, paginate until all data's extracted
        runPromises = []
        runs = Math.ceil results.totalResults / gaMaxRowsPerRequest
        queryObj["start-index"] = gaMaxRowsPerRequest + 1
        while runs -= 1
          runPromise = @ga.getAsync(queryObj).get(0).then (results) ->
            data = data.concat results.rows
            return
          runPromises.push runPromise
          queryObj["start-index"] += gaMaxRowsPerRequest
        Promise.all(runPromises).then -> data
      .catch (err) ->
        throw new Error "Extraction error, err = #{ err.message }"

# ==========

module.exports = GaExtractor
