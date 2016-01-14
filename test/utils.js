var {System, Thread} = java.lang;
var {File} = java.io;

exports.waitFor = function(callback) {
    var timeout = System.currentTimeMillis() + 2000;
    while (callback() == false) {
        if (System.currentTimeMillis() < timeout) {
            Thread.currentThread().sleep(100);
        } else {
            throw new Error("Timeout");
        }
    }
    return true;
};

exports.getTempDir = function() {
    var tempDir = new File(System.getProperty("java.io.tmpdir"),
            "index" + System.nanoTime());
    if (!tempDir.mkdir()) {
        throw new Error("Unable to create temporary index directory: " +
                tempDir.getAbsolutePath());
    }
    return tempDir;
};
