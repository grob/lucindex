var system = require("system");

var index = require("./index_test");

if (require.main == module.id) {
    system.exit(require("test").run.apply(null,
            [index].concat(system.args.slice(1))));
}