/*jshint browser:true */
/*global console */
/**
 * Script getting injected during preview in order to instrument from the tool.
 */

(function() {
    var _montageWillLoad = window.montageWillLoad,
        timer = null,
        disconnectionMessageElement;

    function dispatchEvent(type, detail) {
        var event;

        event = document.createEvent('CustomEvent');
        event.initCustomEvent(type, true, true, detail);
        window.dispatchEvent(event);

        return event;
    }

    function processIncomingData(data) {
        var command = data.substring(0, data.indexOf(":"));
        //var param = data.substring(data.indexOf(":") + 1);

        // REFRESH
        if (command === "refresh") {
            var event = dispatchEvent("lumieresRefresh");
            if (!event.defaultPrevented) {
                document.location.reload();
            }
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
            showReconnectionMessage(websocketRefresh);
        };
    }

    function httpRefresh() {
        var xhr = new XMLHttpRequest();

        xhr.open('GET', '{$PREVIEW}/', true);
        xhr.responseType = 'text';

        xhr.onload = function(event) {
            try {
                if (this.status === 200 &&
                    this.getResponseHeader("content-type") === "application/preview-message") {
                    processIncomingData(this.responseText);
                    httpRefresh();
                } else if (this.status === 204) {
                    httpRefresh();
                } else {
                    showReconnectionMessage(httpRefresh);
                }
            } catch(error) {
                console.log(error);
            }
        };

        xhr.onerror = function(event) {
            showReconnectionMessage(httpRefresh);
        };

        xhr.onabort = function(event) {
        };

        xhr.ontimeout = function(event) {
            showReconnectionMessage(httpRefresh);
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

        disconnectionMessageElement = createReconnectionMessageElement();
    }

    function createReconnectionMessageElement() {
        var div = document.createElement("div");

        div.innerHTML = 'Not connected to the tool. Connecting in <span></span>s... <a href="#" style="color: black">Connect now</a>';
        div.setAttribute("style", "border: 1px solid black;" +
            "background-color: red;" +
            "padding: 8px;" +
            "position: absolute;" +
            "top: 40px;" +
            "font-size: 16pt;" +
            "z-index: 9999;");

        return div;
    }

    var lastReconnectionTime = 0;
    var reconnectionTries = 0;
    function showReconnectionMessage(reconnectCallback) {
        // If the last time a reconnect was attempted was less than 1s ago
        // then assume that a reconnection was not possible.
        if (Date.now() - lastReconnectionTime < 1000) {
            reconnectionTries++;
        } else {
            reconnectionTries = 0;
        }
        // Increase exponentially the timeout to reconnect.
        var reconnectTime = Math.pow(4, reconnectionTries + 1);

        var secondsElement = disconnectionMessageElement.querySelector("span");
        var connectNowElement = disconnectionMessageElement.querySelector("a");

        var timer;
        var time = 0;
        var reconnect = function() {
            reconnectCallback();
            document.body.removeChild(disconnectionMessageElement);
            clearInterval(timer);
        };
        connectNowElement.onclick = reconnect;
        // Update the seconds to reconnect, in the message, at every second.
        // When the time is up try to reconnect.
        timer = setInterval(function() {
            if (++time === reconnectTime) {
                lastReconnectionTime = Date.now();
                reconnect();
            }
            secondsElement.textContent = (reconnectTime - time);
        }, 1000);

        disconnectionMessageElement.style.visibility = "hidden";
        document.body.appendChild(disconnectionMessageElement);
        disconnectionMessageElement.style.left = ((document.body.offsetWidth - disconnectionMessageElement.offsetWidth) / 2) + "px";
        disconnectionMessageElement.style.visibility = "visible";
    }

    timer = setTimeout(function() {  // in case something went wrong with Montage
        _montageWillLoad = null;
        setup();
    }, 5000);

    window.montageWillLoad = function() {
        setup();
    };
}());

