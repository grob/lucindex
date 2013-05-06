for each (var i in ["../jars/commons-codec-1.8.jar",
                    "../jars/lucene-core-4.2.1.jar",
                    "../jars/lucene-analyzers-common-4.2.1.jar",
                    "../jars/lucene-analyzers-phonetic-4.2.1.jar"]) {
    if (!addToClasspath(i)) throw new Error("lucindex unable to add " + i);
}

var {Analyzer} = org.apache.lucene.analysis;
var {LowerCaseFilter} = org.apache.lucene.analysis.core;
var {StandardTokenizer, StandardFilter} = org.apache.lucene.analysis.standard;
var {PhoneticFilter} = org.apache.lucene.analysis.phonetic;
var {RefinedSoundex, ColognePhonetic} = org.apache.commons.codec.language;
var colognePhoneticInstance = new ColognePhonetic();
var {Version} = org.apache.lucene.util;
var {PerFieldAnalyzerWrapper} = org.apache.lucene.analysis.miscellaneous;
var {StandardAnalyzer} = org.apache.lucene.analysis.standard;

exports.createPhoneticAnalyzer = function(version, useColognePhonetic) {
    if (!version) {
        version = Version.LUCENE_42;
    } else if (typeof(version) == "string") {
        version = Version[version];
    }
    return new Analyzer({createComponents: function(fieldName, reader) {
        var tokenizer = new StandardTokenizer(version, reader);
        var filter = new StandardFilter(version, tokenizer);
        filter = new LowerCaseFilter(version, filter);
        filter = new PhoneticFilter(filter, useColognePhonetic ? 
                colognePhoneticInstance : RefinedSoundex.US_ENGLISH, false);
        return new Analyzer.TokenStreamComponents(tokenizer, filter);
    }});
};

exports.createPerFieldAnalyzer = function(defaultAnalyzer, map) {
    return new PerFieldAnalyzerWrapper(defaultAnalyzer, map);
};

exports.createStandardAnalyzer = function(version) {
    if (!version) {
        version = Version.LUCENE_42;
    } else if (typeof(version) == "string") {
        version = Version[version];
    }
    return new StandardAnalyzer(version);
};