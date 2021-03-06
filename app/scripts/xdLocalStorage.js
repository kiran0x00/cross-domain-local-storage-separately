/**
 * Created by dagan on 07/04/2014.
 * Modified by fantajeon on 10/08/2017.
 */

import XdUtils from './services/xd-utils.js';

'use strict';
/* global console, XdUtils */
var MESSAGE_NAMESPACE_CALLER = 'cross-domain-local-message-caller';
var MESSAGE_NAMESPACE_IFRAME = 'cross-domain-local-message-iframe';
var options = {
  iframeId: 'cross-domain-iframe',
  iframeUrl: undefined,
  nameSpace: undefined,
  initCallback: function (frameid) {}
};
var requestId = -1;
var requests = {};

function applyCallback(data) {
  if (requests[data.id]) {
    requests[data.id](data);
    delete requests[data.id];
  }
}

function receiveMessage(event) {
  var data;
  try {
    data = JSON.parse(event.data);
  } catch (err) {
    //not our message, can ignore
  }
  if (data && data.namespace === MESSAGE_NAMESPACE_IFRAME) {
    if (data.id === 'iframe-ready') {
      var ns = data.ns;
      if( ns in window.xdLocalStorage.domains ) {
        var obj = window.xdLocalStorage.domains[ns];
        obj.state = "ready";
        obj.initCallback(data);
      }
    } else {
      applyCallback(data);
    }
  }
}


function buildMessage(iframe, action, key, value, callback) {
  if( iframe === undefined || iframe === null ) return;
  requestId++;
  requests[requestId] = callback;
  var data = {
    namespace: MESSAGE_NAMESPACE_CALLER,
    id: requestId,
    action: action,
    key: key,
    value: value,
  };
  iframe.contentWindow.postMessage(JSON.stringify(data), '*');
}

function HookMessage() {
  if (window.addEventListener) {
    window.addEventListener('message', receiveMessage, false);
  } else {
    window.attachEvent('onmessage', receiveMessage);
  }
}

function attach_iframe(exporter, iframe) {
  exporter.domains[iframe.ns] = iframe;
}

function createiframe(exporter, customOptions) {
  options = XdUtils.extend(customOptions, options);
  options.iframeId = "cross-domain-local-storage-" + options.nameSpace;
  var iframe = document.getElementById(options.iframeId);
  if( iframe == null ) {
    var temp = document.createElement('div');
    temp.innerHTML = '<iframe id="' + options.iframeId + '" src=' + options.iframeUrl + ' style="display: none;"></iframe>';
    document.body.appendChild(temp);
    iframe = document.getElementById(options.iframeId);
  }
  iframe.state = "init";
  iframe.ns = options.nameSpace;
  iframe.id = options.iframeId;
  iframe.initCallback = options.initCallback;

  attach_iframe( exporter, iframe );
}

function isDomReady() {
  return (document.readyState === 'complete');
}

var exporter = {
  domains: {},
  state: "init",
  init: function(customOptions) {
    var that = this;
    return new Promise( (resolve, reject) => {
      if ( that.state === "init" ) {
        HookMessage();
        that.state = "hooked";
      }
      if (!customOptions.iframeUrl) {
        throw 'You must specify iframeUrl';
      }

      if( !customOptions.nameSpace ) {
        throw 'You must speicify namespace';
      }

      if (isDomReady()) {
        createiframe(that, customOptions);
        resolve({});
      } else {
        if (document.addEventListener) {
          // All browsers expect IE < 9
          document.addEventListener('readystatechange', function () {
            if (isDomReady()) {
              createiframe(that, customOptions);
              resolve({});
            } else {
              reject({});
            }
          });
        } else {
          // IE < 9
          document.attachEvent('readystatechange', function () {
            if (isDomReady()) {
              createiframe(that, customOptions);
              resolve({});
            } else {
              reject({});
            }
          });
        }
      }
    });
  },
  setItem: function (ns, key, value, callback) {
    buildMessage(this.domains[ns], 'set', key, value, callback);
  },
  getItem: function (ns, key, callback) {
    buildMessage(this.domains[ns], 'get', key,  null, callback);
  },
  removeItem: function (ns, key, callback) {
    buildMessage(this.domains[ns], 'remove', key,  null, callback);
  },
  key: function (ns, index, callback) {
    buildMessage(this.domains[ns], 'key', index,  null, callback);
  },
  getSize: function(ns, callback) {
    buildMessage(this.domains[ns], 'size', null, null, callback);
  },
  getLength: function(ns, callback) {
    buildMessage(this.domains[ns], 'length', null, null, callback);
  },
  clear: function (ns, callback) {
    buildMessage(this.domains[ns], 'clear', null,  null, callback);
  }
}

if( window.xdLocalStorage === undefined || window.xdLocalStorage === null ) {
  window.xdLocalStorage = exporter;
} else {
  exporter = window.xdLocalStorage;
}
export default exporter
