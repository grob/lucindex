var {IndexWriter} = org.apache.lucene.index;

function onmessage(event) {
    try {
        event.data();
        event.source.postMessage({
            "action": "reopen"
        });
    } catch (e) {
        console.error(e);
    }
}
