var utils = require("./utils");

var analysisPKG = org.apache.lucene.analysis;
var {WhitespaceAnalyzer} = analysisPKG.core;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
var {Version} = org.apache.lucene.util;
var {PhoneticFilter} = analysisPKG.phonetic;
var {PerFieldAnalyzerWrapper} = analysisPKG.miscellaneous;

/**
 * Create a analyzer using different analyzers for different fields.
 * The analyzers to use for specific fields have to be given within the map
 * in form of an javascript object or hashmap having the fields as properties
 * and the analyzer to use as value.
 */
var createPerFieldAnalyzer = exports.createPerFieldAnalyzer = function(map, defaultAnalyzer) {
    return new PerFieldAnalyzerWrapper(defaultAnalyzer || createStandardAnalyzer(), map);
};

/**
 * Create a standardanalyzer
 */
var createStandardAnalyzer = exports.createStandardAnalyzer = function(version) {
    return new StandardAnalyzer(utils.resolveVersion(version));
};

/**
 * create a whitespace analyzer
 */
exports.createWhitespaceAnalyzer = function(version) {
    return new WhitespaceAnalyzer(utils.resolveVersion(version));
};

exports.createLanguageSpecificAnalyzer = function(lang, config) {
    switch(lang.toLowerCase) {
    case "de":
        if (!config)
            return new analysisPKG.common.de.GermanAnalyzer(Version.LUCENE_47);
        var version = utils.resolveVersion(config.version);
        if (!config.stopwords && !config.stemexclusions) {
            return new analysisPKG.common.de.GermanAnalyzer(version);
        }
        return new analysisPKG.common.de.GermanAnalyzer(version, config.stopwords, config.stemexclusions);
    default:
        return createStandardAnalyzer(config ? config.version : undefined);
    }
};