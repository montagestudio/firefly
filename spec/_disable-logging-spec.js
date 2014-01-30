// Disable logging in the tests
function noop() {}
require("logging").from = function () { return noop; };
