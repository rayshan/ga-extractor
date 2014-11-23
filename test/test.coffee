# vendor
p = require 'path'
fs = require "fs"

chaiAsPromised = require "chai-as-promised"
should = require('chai').use(chaiAsPromised).should()

# custom

GaExtractor = require '../lib'
options = require './fixtures/options.json'
#options.keyPath = p.join __dirname, "fixtures", options.keyFileName

# ==========

gaExtractor = new GaExtractor {
  profileId: options.profileId # optional, if not defined, must be in every queryObj
  clientEmail: options.clientEmail
  keyPath: options.keyPath # defined from project root
  impersonatedUser: options.impersonatedUser
}

# ensure authed with GA before running tests
before -> gaExtractor.auth()

# ==========

describe 'GaExtractor', ->
  it "should throw error upon instantiation if clientEmail isn't provided", ->
    (-> new GaExtractor {
      profileId: options.profileId
      keyPath: options.keyPath
    }).should.throw Error

  it "should throw error upon instantiation if keyPath or keyContent isn't provided", ->
    (-> new GaExtractor {
      profileId: options.profileId
      clientEmail: options.clientEmail
    }).should.throw Error

  it 'should instantiate & auth with a .p12 key file', ->
    gaExtractorWithKeyPath = new GaExtractor {
      profileId: options.profileId
      clientEmail: options.clientEmail
      keyPath: options.keyPath
    }
    gaExtractorWithKeyPath.auth().should.eventually.have.property 'access_token'

  it 'should instantiate & auth with keyContent as string read from .p12 file', ->
    gaExtractorWithKeyContent = new GaExtractor {
      profileId: options.profileId
      clientEmail: options.clientEmail
      keyContent: fs.readFileSync options.keyContent, ['utf-8']
    }
    gaExtractorWithKeyContent.auth().should.eventually.have.property 'access_token'

  it 'should instantiate with proxy', ->
    (-> new GaExtractor {
      profileId: options.profileId
      clientEmail: options.clientEmail
      keyContent: fs.readFileSync options.keyPath, ['utf-8']
      proxy: 'http://proxy.example.com'
    }).should.not.throw Error

describe '.auth instance method', ->
  it 'should auth & return a promise resolved with a token', ->
    gaExtractor.auth().should.eventually.have.property 'access_token'

  it 'should resolve with error if error during auth', ->
    gaExtractorBad = new GaExtractor {
      profileId: options.profileId
      clientEmail: "fake"
      keyPath: options.keyPath
    }
    gaExtractorBad.auth().should.be.rejectedWith Error

describe '.extract instance method', ->
  @.timeout 4000

  it 'should extract data with right num of columns per queryObj', ->
    columnCount = options.queryObj.metrics.split(',').length +
        options.queryObj.dimensions.split(',').length
    gaExtractor.extract options.queryObj
      .should.eventually.have.deep.property '[0]' # 1st row of data
      .with.length columnCount

  it 'should resolve with error if error during extraction', ->
    gaExtractor.extract({}).should.be.rejectedWith Error

  it 'should auto paginate and fetch all data if > 10k rows returned', ->
    @.timeout 0 # disable timeout b/c > 10k rows may take a while
    gaExtractor.extract(options.queryObjLong).should.eventually.have.length.above 10000
