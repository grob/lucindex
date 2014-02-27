function onmessage(event) {
    var {workerNr, nrOfWorkers, manager, docsPerWorker} = event.data;
    switch (event.data.action) {
        case "remove":
            for (let i=0; i<docsPerWorker; i+=1) {
                manager.remove("id", (workerNr * nrOfWorkers) + i);
            }
            break;
        case "add":
            for (let i=0; i<docsPerWorker; i+=1) {
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
