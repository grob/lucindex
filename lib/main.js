var strings = require("ringo/utils/strings");

// add all jar files in jars directory to classpath
var repo = getRepository(module.resolve("../jars/"));
repo.getResources().filter(function(r) {
    return strings.endsWith(r.name, ".jar");
}).forEach(function(file) {
    if (!addToClasspath(file)) {
        throw new Error("Unable to add " + file + " to classpath");
    }
});

exports.Index = require("./index").Index;
exports.SimpleIndex = require("./simpleindex").SimpleIndex;
exports.analyzerFactory = require("./analyzer");
exports.QueryBuilder = require("./querybuilder").QueryBuilder;