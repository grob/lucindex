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
var {RefinedSoundex} = org.apache.commons.codec.language;
var {Version} = org.apache.lucene.util;

exports.createPhoneticAnalyzer = function(version) {
    if (!version) {
        version = Version.LUCENE_42;
    } else if (typeof(version) == "string") {
        version = Version[version];
    }
    return new Analyzer({createComponents: function(fieldName, reader) {
        print(StandardTokenizer);
        print(version);
        var tokenizer = new StandardTokenizer(version, reader);
        var filter = new StandardFilter(version, tokenizer);
        filter = new LowerCaseFilter(version, filter);
        filter = new PhoneticFilter(filter, RefinedSoundex.US_ENGLISH, false);
        return new Analyzer.TokenStreamComponents(tokenizer, filter);
    }});
};