// Disable logging in the tests
function noop() {}
require("../common/logging").from = function () { return noop; };
