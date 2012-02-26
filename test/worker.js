function onmessage(event) {
    var workerNr = event.data.workerNr;
    var manager = event.data.manager;
    var docsPerWorker = event.data.docsPerWorker;
    switch (event.data.action) {
        case "remove":
            for (var i=0; i<docsPerWorker; i+=1) {
                manager.remove("id", (workerNr * 10) + i);
            }
            break;
        case "add":
            for (var i=0; i<docsPerWorker; i+=1) {
                manager.add(event.data.getSampleDocument((workerNr * 10) + i));
            }
            break;
        default:
            throw new Error("Unknown action " + event.data.action);
    }
    event.source.postMessage({
        "workerNr": workerNr
    });
}
