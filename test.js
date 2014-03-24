var logging = require("ringo/logging");
logging.setConfig(getResource(module.resolve("./log4j.properties")));
var log = logging.getLogger(module.id);

var {Index, SimpleIndex, analyzerFactory} = require("./lib/main");
var VER = "LUCENE_47";
var sa = analyzerFactory.createStandardAnalyzer(VER);

var pa = analyzerFactory.createLanguageSpecificAnalyzer("de", {version: VER});
var analyzer = analyzerFactory.createPerFieldAnalyzer({"name": pa, "address": pa}, sa);
// var analyzer = sa;

var rawidx = Index.createIndex("/tmp/", "testindex", analyzer, VER);
var idx = new SimpleIndex(rawidx, 
            {defaultField: "name",
             id: {type: "int", store: true}, 
             count: {type: "float", store: true}, 
             name: {store: true}, address: {store: false}});
print("size: " + idx.size());

idx.removeAll();
java.lang.Thread.sleep(1000);
print("size: " + idx.size());

var docs = [{id: 1, name: "bernd", count: 5.1, address: "Mustergasse 8"},
            {id: 2, name: "tom", count: 7.3, address: "Musterstra�e 9"},
            {id: 3, name: "christian", count: 5.2, address: "Silbergasse 14"},
            {id: 4, name: "robert", count: 5.3, address: "Mariahilferstra�e 1"},
            {id: 5, name: "marius", count: 5.4, address: "Musterweg 9"},
            {id: 6, name: "manfred", count: 5.5, address: "Hufeisengasse"}];

for each (var doc in docs) {
    idx.add(doc);
}

java.lang.Thread.sleep(1000);
print("size: " + idx.size());

idx.update("id", 1, {id: 1, name: "berndi", count: 5.2, address: "Mustergasse 8"});

java.lang.Thread.sleep(1000);
print("size: " + idx.size());

var qry = idx.createQuery({name: "ma*", address: "muster*", MUST_NOT: {id: 6}});
var result = idx.query(qry);
print(result.size());
print(JSON.stringify(result));

result = idx.query(idx.createQuery({count: {min: 5.2, max: 5.5}}));
print(result.size());
print(JSON.stringify(result));