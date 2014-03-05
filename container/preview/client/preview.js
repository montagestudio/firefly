/*jshint browser:true */
/*global Declarativ, console */
/**
 * Script getting injected during preview in order to instrument from the tool.
 */

(function() {
    var DEBUG_OPSS = Declarativ.DEVELOPMENT && false;
    var DEBUG_SPEED = Declarativ.DEVELOPMENT && true;
    var DEBUG_CONNECTION = Declarativ.DEVELOPMENT && true;
    var _montageWillLoad = window.montageWillLoad,
        timer = null,
        disconnectionMessageElement,
        LiveEdit = Declarativ.LiveEdit,
        dataProcessingPromise,
        previousTime = window.performance.now(),
        operations = 0;

    function dispatchEvent(type, detail) {
        var event;

        event = document.createEvent('CustomEvent');
        event.initCustomEvent(type, true, true, detail);
        window.dispatchEvent(event);

        return event;
    }

    function processIncomingData(data) {
        var command = data.substring(0, data.indexOf(":"));
        var param = data.substring(data.indexOf(":") + 1);
        var args;
        var startTime;

        if (!dataProcessingPromise) {
            dataProcessingPromise = Declarativ.Promise.resolve();
        }

        if (command === "refresh") {
            var event = dispatchEvent("lumieresRefresh");
            if (!event.defaultPrevented) {
                document.location.reload();
            }
            return;
        }

        //jshint -W074
        dataProcessingPromise = dataProcessingPromise.then(function() {
            if (DEBUG_SPEED) {
                startTime = window.performance.now();
            }
            if (DEBUG_OPSS) {
                var time = window.performance.now();
                if (time - previousTime >= 1000) {
                    console.log("ops/s: ", operations);
                    previousTime = time;
                    operations = 0;
                }
                operations++;
            }

            if (command === "setObjectProperties") {
                args = JSON.parse(param);
                return LiveEdit.setObjectProperties(args.label, args.ownerModuleId, args.properties);
            }

            if (command === "setObjectProperty") {
                args = JSON.parse(param);
                return LiveEdit.setObjectProperty(args.ownerModuleId, args.label, args.propertyName, args.propertyValue, args.propertyType);
            }

            if (command === "setObjectLabel") {
                args = JSON.parse(param);
                return LiveEdit.setObjectLabel(args.ownerModuleId, args.label, args.newLabel);
            }

            if (command === "setObjectBinding") {
                args = JSON.parse(param);
                return LiveEdit.setObjectBinding(args.ownerModuleId, args.label, args.binding);
            }

            if (command === "deleteObjectBinding") {
                args = JSON.parse(param);
                return LiveEdit.deleteObjectBinding(args.ownerModuleId, args.label, args.path);
            }

            if (command === "addTemplateFragment") {
                args = JSON.parse(param);
                return LiveEdit.addTemplateFragment(args.moduleId, args.elementLocation, args.how, args.templateFragment);
            }

            if (command === "addTemplateFragmentObjects") {
                args = JSON.parse(param);
                return LiveEdit.addTemplateFragmentObjects(args.moduleId, args.templateFragment);
            }

            if (command === "setElementAttribute") {
                args = JSON.parse(param);
                return LiveEdit.setElementAttribute(args.moduleId,
                    args.elementLocation,args.attributeName, args.attributeValue);
            }

            if (command === "addObjectEventListener") {
                args = JSON.parse(param);
                return LiveEdit.addObjectEventListener(args.moduleId, args.label, args.type, args.listenerLabel, args.useCapture);
            }

            if (command === "removeObjectEventListener") {
                args = JSON.parse(param);
                return LiveEdit.removeObjectEventListener(args.moduleId, args.label, args.type, args.listenerLabel, args.useCapture);
            }
        }).fail(function(reason) {
            console.log("fail: ", reason);
        });
        //jshint +W074

        if (DEBUG_SPEED) {
            dataProcessingPromise = dataProcessingPromise.then(function() {
                console.log(command + ": ", window.performance.now() - startTime);
            });
        }
    }

    var ws;
    function websocketRefresh() {
        if (ws) {
            // TODO find out why sometimes we make two connections at once.
            return;
        }
        var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(protocol + "//" + document.location.host);
        ws.onopen = function() {
            if (DEBUG_CONNECTION) {
                console.log("Connected to the tool.");
            }
        };

        ws.onmessage = function(message) {
            processIncomingData(message.data);
        };

        ws.onclose = function() {
            ws = null;
            if (DEBUG_CONNECTION) {
                console.log("Disconnected from the tool.");
            }
            showReconnectionMessage(websocketRefresh);
        };
    }

    function setup() {
        if (timer) {
            clearTimeout(timer);
        }

        if (typeof(WebSocket) === "function" || typeof(WebSocket) === "object") {
            websocketRefresh();
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
            lastReconnectionTime = Date.now();
            reconnectCallback();
            return;
        }
        // Increase exponentially the timeout to reconnect.
        var reconnectTime = Math.pow(4, reconnectionTries + 1);

        var secondsElement = disconnectionMessageElement.querySelector("span");
        var connectNowElement = disconnectionMessageElement.querySelector("a");

        var timer;
        var time = 0;
        var reconnect = function() {
            reconnectCallback();
            if (disconnectionMessageElement.parentNode === document.body) {
                document.body.removeChild(disconnectionMessageElement);
            }
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

