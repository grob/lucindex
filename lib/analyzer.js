var analysisPKG = org.apache.lucene.analysis;
var {WhitespaceAnalyzer} = analysisPKG.core;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;
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
var createStandardAnalyzer = exports.createStandardAnalyzer = function() {
    return new StandardAnalyzer();
};

/**
 * create a whitespace analyzer
 */
exports.createWhitespaceAnalyzer = function() {
    return new WhitespaceAnalyzer();
};

exports.createLanguageSpecificAnalyzer = function(lang, config) {
    switch(lang.toLowerCase()) {
    case "de":
        if (!config) {
            return new analysisPKG.de.GermanAnalyzer();
        }
        if (!config.stopwords && !config.stemexclusions) {
            return new analysisPKG.de.GermanAnalyzer();
        }
        return new analysisPKG.de.GermanAnalyzer(config.stopwords, config.stemexclusions);
    default:
        return createStandardAnalyzer();
    }
};