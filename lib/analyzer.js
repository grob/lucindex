const {WhitespaceAnalyzer} = org.apache.lucene.analysis.core;
const {StandardAnalyzer} = org.apache.lucene.analysis.standard;
const {PerFieldAnalyzerWrapper} = org.apache.lucene.analysis.miscellaneous;
const {GermanAnalyzer} = org.apache.lucene.analysis.de;

/**
 * Create a analyzer using different analyzers for different fields.
 * The analyzers to use for specific fields have to be given within the map
 * in form of an javascript object or hashmap having the fields as properties
 * and the analyzer to use as value.
 */
const createPerFieldAnalyzer = exports.createPerFieldAnalyzer = (map, defaultAnalyzer) => {
    return new PerFieldAnalyzerWrapper(defaultAnalyzer || createStandardAnalyzer(), map);
};

/**
 * Create a standardanalyzer
 */
const createStandardAnalyzer = exports.createStandardAnalyzer = () => {
    return new StandardAnalyzer();
};

/**
 * create a whitespace analyzer
 */
exports.createWhitespaceAnalyzer = () => {
    return new WhitespaceAnalyzer();
};

exports.createLanguageSpecificAnalyzer = (lang, config) => {
    switch(lang.toLowerCase()) {
        case "de":
            if (config) {
                return new GermanAnalyzer(config.stopwords || null, config.stemexclusions || null);
            }
            return new GermanAnalyzer();
        default:
            return createStandardAnalyzer();
    }
};