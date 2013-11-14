var Montage = require("montage").Montage;

exports.EnvironmentBridge = Montage.specialize({

    constructor: {
        value: function EnvironmentBridge() {
            this.super();
        }
    },

    save: {
        value: Function.noop
    }

});
