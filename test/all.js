var system = require("system");

exports.testIndex = require("./index_test");
exports.testSimpleindex = require("./simpleindex_test");

if (require.main == module.id) {
    system.exit(require("test").run.apply(null,
            [exports].concat(system.args.slice(1))));
}