/*jshint browser:true */
/*global confirm, console */
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

    function processIncomingData(data) {
        var command = data.substring(0, data.indexOf(":")),
            param = data.substring(data.indexOf(":") + 1);

        // REFRESH
        if (command === "refresh") {
            var event = dispatchEvent("lumieresRefresh");
            if (!event.defaultPrevented) {
                document.location.reload();
            }
        }

        // LAUNCH
        else if (command === "launch") {
            var newLocation = document.location.origin + "/" + param + "/";
            document.location.href = newLocation;
        }
    }

    function websocketRefresh() {
        var ws = new WebSocket("ws://" + document.location.host);

        ws.onopen = function() {
        };

        ws.onmessage = function(message) {
            processIncomingData(message.data);
        };

        ws.onclose = function() {
            if (confirm(kDeconnectionMessage) === true) {
                websocketRefresh();
            }
        };
    }

    function httpRefresh() {
        var xhr = new XMLHttpRequest();

        xhr.open('GET', '{$PREVIEW}/', true);
        xhr.responseType = 'text';

        xhr.onload = function(event) {
            try {
                if (this.status === 200) {
                    processIncomingData(this.responseText);
                    httpRefresh();
                } else if (this.status === 404) {
                    if (confirm("404: " + kDeconnectionMessage) === true) {
                        httpRefresh();
                    }
                } else {
                    httpRefresh();
                }
            } catch(error) {
                console.log(error);
            }
        };

        xhr.onerror = function(event) {
            if (confirm(kDeconnectionMessage) === true) {
                httpRefresh();
            }
        };

        xhr.onabort = function(event) {
        };

        xhr.ontimeout = function(event) {
            if (confirm(kDeconnectionMessage) === true) {
                httpRefresh();
            }
        };

        xhr.send();
    }

    function setup() {
        if (timer) {
            clearTimeout(timer);
        }

        if (typeof(WebSocket) === "function" || typeof(WebSocket) === "object") {
            websocketRefresh();
        } else {
            // Wait a bit more to not consume right away one of the http
            // connections allowed by the browser or server.
            setTimeout(httpRefresh, 2000);
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

