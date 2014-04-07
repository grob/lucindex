for each (var i in ["../jars/lucene-core-4.7.0.jar",
                    "../jars/lucene-analyzers-common-4.7.0.jar",
                    "../jars/lucene-queryparser-4.7.0.jar"]) {
    if (!addToClasspath(i)) throw new Error("lucindex unable to add " + i);
}

exports.Index = require("./index").Index;
exports.SimpleIndex = require("./simpleindex").SimpleIndex;
exports.analyzerFactory = require("./analyzer");
exports.QueryBuilder = require("./querybuilder").QueryBuilder;