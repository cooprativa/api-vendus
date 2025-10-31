import React from "react"; // <--- You need to import React to use React.createElement
import { RemixServer } from "@remix-run/react";
import { isbot } from "isbot";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";

export default function handleDocumentRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const stream = new PassThrough();

    const { pipe } = renderToPipeableStream(
      // Replaced <RemixServer context={remixContext} url={request.url} /> with React.createElement
      React.createElement(RemixServer, { context: remixContext, url: request.url }),
      {
        onShellReady() {
          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(stream, {
              status: didError ? 500 : responseStatusCode,
              headers: responseHeaders,
            })
          );

          pipe(stream);
        },
        onShellError(err) {
          reject(err);
        },
        onError(err) {
          didError = true;
          console.error(err);
        },
      }
    );
  });
}
