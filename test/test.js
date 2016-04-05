"use strict";

const p = require('path'),
    fs = require("fs"),
    chaiAsPromised = require("chai-as-promised"),
    should = require('chai').use(chaiAsPromised).should(),
    GaExtractor = require('../src'),
    options = require('./fixtures/options.json');

// =================================================================================================

describe('.auth instance method', function () {
    afterEach(function () {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    });
    it('should be rejected with error if failed to auth', function () {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = "options.keyPath";
        const gaExtractorBad = new GaExtractor({profileId: options.profileId});
        return gaExtractorBad.auth().should.be.rejectedWith(Error);
    });
    it('should authenticate & return a promise resolved with a token', function () {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = options.keyPath;
        const gaExtractor = new GaExtractor({profileId: options.profileId});
        return gaExtractor.auth().should.eventually.have.property('refresh_token');
    });
});

describe('GaExtractor constructor', function () {
    afterEach(function () {
        delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    });
    it("should throw upon instantiation if keyPath or environmental variable GOOGLE_APPLICATION_CREDENTIALS isn't set",
        function () {
            (function () {new GaExtractor({profileId: options.profileId})}).should.throw(Error);
        }
    );
    it('should instantiate & authenticate if keyPath option is provided', function () {
        const gaExtractorWithKeyContent = new GaExtractor({
            profileId: options.profileId,
            keyPath: options.keyPath
        });
        return gaExtractorWithKeyContent.auth()
            .should.eventually.have.property('refresh_token');
    });
    it('should instantiate and authenticate if GOOGLE_APPLICATION_CREDENTIALS is set', function () {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = options.keyPath;
        const gaExtractorWithKeyPath = new GaExtractor({profileId: options.profileId});
        return gaExtractorWithKeyPath.auth()
            .should
            .eventually
            .have
            .property('refresh_token');
    });
});

describe('.extract instance method', function () {
    let gaExtractor;
    before(function () {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = options.keyPath;
        gaExtractor = new GaExtractor({profileId: options.profileId});
    });
    this.timeout(5000);
    it('should extract data with right num of columns', function (done) {
        const columnCount = options.queryObj.metrics.split(',').length +
            options.queryObj.dimensions.split(',').length;
        return gaExtractor.extract(options.queryObj)
            .then(function (data) {
                data[0].should.have.length(columnCount);
                return done();
            });
    });
    it('should resolve with error if error during extraction', function () {
        return gaExtractor.extract({}).should.be.rejectedWith(Error);
    });
    this.timeout(0); // Disable timeout as >= 10k rows may take a while
    it('should auto paginate and fetch all data if > 10k rows returned', function () {
        return gaExtractor.extract(options.queryObjLong)
            .should.eventually.have.length.above(10000);
    });
});
