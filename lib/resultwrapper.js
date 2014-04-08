
/**
 * @class Result-object holding query-time and the resulting top-documents of a lucene-search
 * @param topdocs the documents retrieved
 * @param querytime the time querying took
 * @param index the index the documents have been retrieved from
 * @constructor
 */
var Result = exports.Result = function(data, si) {
    Object.defineProperties(this, {
        querytime: { // FIXME: this is only the first querytime of the first page
            value: data.querytime
        },
        si: {
            value: si,
            readonly: true,
            enumerate: false
        }
    });

    var docs = [];
    var docStore = [], docScore = [];
    var addAll = function(topdocs) {
        for (var i = 0; i < topdocs.totalHits; i++) {
            var doc = data.searcher.doc(topdocs.scoreDocs[i].doc);
            if (doc == null) {
                // FIXME: is this possible at all?
                docStore[i] = null;
                continue;
            }
            docs[i] = {
                    score: topdocs.scoreDocs[i].score,
                    data: si.convertDocument(doc)
            };
        }
    };
    addAll(data.topdocs);
    si.index.releaseSearcher(data.searcher);

    /**
     * returns the size of this resultset
     */
    this.size = function() {
        return docs.length;
    };

    /**
     * Returns the nth document of this resultset as
     * plain javascript object.
     * @param idx the index this document has within this resultset
     */
    this.get = function(idx) {
        if (idx > this.size()) {
            throw new Error("Index out of range");
        }
        return docs[idx].data;
    };

    /**
     * Returns the calculated score of the nth document of this resultset
     */
    this.getScore = function(idx) {
        return docs[idx].score;
    };

    /**
     * Serialize this resultset to an js-object
     */
    this.serialize = function() {
        return docs;
    };

    this.reduce = function(func, initialVal) {
        return docs.reduce(func, initalVal);
    };

    this.toJSON = function() {
        return this.serialize();
    };
};