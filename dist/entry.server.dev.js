"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = handleDocumentRequest;

var _react = _interopRequireDefault(require("react"));

var _react2 = require("@remix-run/react");

var _isbot = require("isbot");

var _stream = require("stream");

var _server = require("react-dom/server");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// <--- You need to import React to use React.createElement
function handleDocumentRequest(request, responseStatusCode, responseHeaders, remixContext) {
  return new Promise(function (resolve, reject) {
    var didError = false;
    var stream = new _stream.PassThrough();

    var _renderToPipeableStre = (0, _server.renderToPipeableStream)( // Replaced <RemixServer context={remixContext} url={request.url} /> with React.createElement
    _react["default"].createElement(_react2.RemixServer, {
      context: remixContext,
      url: request.url
    }), {
      onShellReady: function onShellReady() {
        responseHeaders.set("Content-Type", "text/html");
        resolve(new Response(stream, {
          status: didError ? 500 : responseStatusCode,
          headers: responseHeaders
        }));
        pipe(stream);
      },
      onShellError: function onShellError(err) {
        reject(err);
      },
      onError: function onError(err) {
        didError = true;
        console.error(err);
      }
    }),
        pipe = _renderToPipeableStre.pipe;
  });
}
//# sourceMappingURL=entry.server.dev.js.map
