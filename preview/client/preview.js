/*jshint browser:true */
/*global confirm */
/**
 * Script getting injected during preview in order to instrument from the tool.
 */

(function() {
    var _montageWillLoad = window.montageWillLoad,
        timer = null;

    var kDeconnectionMessage = "This project has been disconnected from Montage Builder!\n\n Would you like to reconnect?";

    function dispatchEvent(type, detail) {
        var event;

        event = document.createEvent('CustomEvent');
        event.initCustomEvent(type, true, true, detail);
        window.dispatchEvent(event);

        return event;
    }

    function websocketRefresh() {
        var ws = new WebSocket("ws://" + document.location.host);

        ws.onopen = function() {
        };

        ws.onmessage = function(message) {
            var data = message.data,
                command = data.substring(0, data.indexOf(":")),
                param = data.substring(data.indexOf(":") + 1);

            /// REFRESH
            if (command === "refresh") {
                var event = dispatchEvent("lumieresRefresh");
                if (!event.defaultPrevented) {
                    document.location.reload();
                }
            }

            /// LAUNCH
            else if (command === "launch") {
                var newLocation = document.location.origin + "/" + param + "/";
                document.location.href = newLocation;
            }
        };

        ws.onclose = function() {
            if (confirm(kDeconnectionMessage) === true) {
                dispatchEvent("lumieresConnect");
            }
        };

    }

    function setup() {
        if (timer) {
            clearTimeout(timer);
        }

        if (typeof(WebSocket) === "function" || typeof(WebSocket) === "object") {
            window.addEventListener("lumieresConnect", websocketRefresh);
            websocketRefresh();
        }

        if (typeof _montageWillLoad === "function") {
            _montageWillLoad();
        }
    }

    timer = setTimeout(function() {  // in case something went wrong with Montage
        _montageWillLoad = null;
        setup();
    }, 5000);

    window.montageWillLoad = function() {
        setup();
    };
}());

