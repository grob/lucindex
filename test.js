var logging = require("ringo/logging");
logging.setConfig(getResource(module.resolve("./log4j.properties")));
var log = logging.getLogger(module.id);
var {Index, SimpleIndex, analyzerFactory} = require("./lib/main");
var {TextField, DoubleField, IntField, DateField, LongField, StringField} = require("./lib/converter");

var printSleep = function() {
    print("sleeping...");
    java.lang.Thread.sleep(1000);
};

var VER = "LUCENE_47";
var sa = analyzerFactory.createStandardAnalyzer(VER);

var pa = analyzerFactory.createLanguageSpecificAnalyzer("de", {version: VER});
var analyzer = analyzerFactory.createPerFieldAnalyzer({"name": pa, "address": pa}, sa);

var rawidx = Index.createIndex("/tmp/", "testindex", analyzer, VER);
var idx = new SimpleIndex(rawidx, 
            {defaultField: "name",
             id: new IntField({name: "id", store: true}), 
             count: new DoubleField({name: "count", store: true}), 
             name: new TextField({name: "name", store: true}),
             address: new TextField({name: "address", store: false}),
             date: new DateField({name: "date", store: true, resolution: "DAY"}),
             title: new StringField({name: "title", store: true})});
print("size: " + idx.size());

idx.removeAll();
printSleep();
print("size: " + idx.size());

var docs = [{id: 1, name: "bernd", count: 5.1, address: "Mustergasse 8", date: new Date("2014-01-01T02:32:00.000Z"), title: "DDr"},
            {id: 2, name: "tom", count: 7.3, address: "Musterstraße 9", date: new Date("2014-01-02T02:32:00.000Z"), title: "Dr"},
            {id: 3, name: "christian", count: 5.2, address: "Silbergasse 14", date: new Date("2014-01-03T02:32:00.000Z"), title: "Ing"},
            {id: 4, name: "robert", count: 5.3, address: "Mariahilferstra�e 1", date: new Date("2014-01-04T02:32:00.000Z"), title: "Mag"},
            {id: 5, name: "marius", count: 5.4, address: "Musterweg 9", date: new Date("2014-01-05T02:32:00.000Z"), title: "DiplIng"},
            {id: 6, name: "manfred", count: 5.5, address: "Hufeisengasse", date: new Date("2014-01-06T02:32:00.000Z"), title: "M"}];

for each (var doc in docs) {
    idx.add(doc);
}

printSleep();
print("size: " + idx.size());

idx.update("id", 1, {id: 1, name: "berndi"});

printSleep();
print("size: " + idx.size());

var queries = [
               {name: "ma*"},
               {count: 5.3},
               {address: "Muster*", MUST_NOT: {id: 6}},
               {date: {min: "2014-01-02T02:32:00.000Z", max: "2014-01-04T02:32:00.000Z"}},
               {title: "Dr"},
               {date: "2014-01-03T02:39:00.000Z"}];

for each (var qry in queries) {
    var result = idx.query(idx.createQuery(qry));
    print("found:", result.size());
    for (var i = 0; i < result.size(); i++) {
        print(result.getScore(i), JSON.stringify(result.get(i)));
    }
    print("Took", result.querytime, "millis");
    print("================================");
};