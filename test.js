var {Index} = require("lucindex/lib/index");
var {SimpleIndex} = require("lucindex/lib/simpleindex");
var analyzerFactory = require("lucindex/lib/analyzer");
var sa = analyzerFactory.createStandardAnalyzer("LUCENE_42");
var rawidx = Index.createIndex("/tmp/", "testindex", sa, "LUCENE_42");
var idx = new SimpleIndex(rawidx, {meta: {id: {type: "int", store: true}, count: {type: "float", store: true}, name: {store: true}}});
print("size: " + idx.size());

idx.removeAll();
java.lang.Thread.sleep(1000);
print("size: " + idx.size());

var doc = {id: 2, name: "hombre", count: 5.3};

idx.update("count", 5.3, doc);
idx.update("count", 5.3, doc);


java.lang.Thread.sleep(1000);

print("size: " + idx.size());

var result = idx.query("name", "homb*");
print(result.size());
for (var i = 0; i < result.size(); i++) {
    print (JSON.stringify(result.get(i)));
};