/*
  SPRITE LOCKER
  GitHub Pages -> Google Apps Script bridge
*/

const SPRITE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby16GaDfmsl0w9DnseX2OSmGfoOw2Mp29EiBfbeGtizLVEGtopcNMmhHT67kcSWxADdYQ/exec';


(function () {

  let iframe = null;
  let ready = false;
  let nextId = 1;

  const queue = [];
  const pending = new Map();


  // ==================================================
  // CREATE APPS SCRIPT IFRAME
  // ==================================================

  function createBridge() {

    if (iframe) return;


    iframe =
      document.createElement(
        'iframe'
      );


    iframe.src =
      SPRITE_APPS_SCRIPT_URL +
      '?bridge=1&parentOrigin=' +
      encodeURIComponent(
        window.location.origin
      );


    iframe.style.position =
      'fixed';

    iframe.style.left =
      '-10000px';

    iframe.style.top =
      '-10000px';

    iframe.style.width =
      '1px';

    iframe.style.height =
      '1px';

    iframe.style.border =
      '0';


    document.body.appendChild(
      iframe
    );


    iframe.onload =
      function () {

        startHandshake();

      };

  }


  // ==================================================
  // HANDSHAKE
  // ==================================================

  function startHandshake() {

    let attempts = 0;


    const timer =
      setInterval(
        function () {

          attempts++;


          if (
            iframe &&
            iframe.contentWindow
          ) {

            iframe.contentWindow
              .postMessage(
                {
                  spriteLockerBridge:
                    true,

                  type:
                    'parent-ready'
                },
                '*'
              );

          }


          if (
            ready ||
            attempts >= 30
          ) {

            clearInterval(
              timer
            );

          }


          if (
            !ready &&
            attempts === 30
          ) {

            showConnectionError();

          }

        },
        300
      );

  }


  // ==================================================
  // RECEIVE FROM APPS SCRIPT
  // ==================================================

  window.addEventListener(
    'message',
    function (event) {

      const data =
        event.data || {};


      if (
        !data.spriteLockerBridge
      ) {
        return;
      }


      /*
        Message must come from our
        Apps Script iframe.
      */

      if (
        !iframe ||
        event.source !==
          iframe.contentWindow
      ) {
        return;
      }


      // ----------------------------------------------
      // BRIDGE READY
      // ----------------------------------------------

      if (
        data.type ===
        'ready'
      ) {

        ready = true;

        flushQueue();

        return;

      }


      // ----------------------------------------------
      // SERVER RESULT
      // ----------------------------------------------

      if (
        data.type !==
        'result'
      ) {
        return;
      }


      const id =
        String(
          data.id
        );


      const request =
        pending.get(
          id
        );


      if (!request) {
        return;
      }


      pending.delete(
        id
      );


      if (
        data.ok
      ) {

        if (
          request.success
        ) {

          request.success(
            data.value
          );

        }

      } else {

        const error =
          new Error(
            data.error ||
            'Server request failed.'
          );


        if (
          request.failure
        ) {

          request.failure(
            error
          );

        } else {

          console.error(
            error
          );

        }

      }

    }
  );


  // ==================================================
  // SEND REQUEST
  // ==================================================

  function sendRequest(
    request
  ) {

    if (
      !ready
    ) {

      queue.push(
        request
      );

      createBridge();

      return;

    }


    iframe.contentWindow
      .postMessage(
        {
          spriteLockerBridge:
            true,

          type:
            'call',

          id:
            request.id,

          functionName:
            request.functionName,

          args:
            request.args
        },
        '*'
      );

  }


  function flushQueue() {

    while (
      queue.length
    ) {

      const request =
        queue.shift();


      iframe.contentWindow
        .postMessage(
          {
            spriteLockerBridge:
              true,

            type:
              'call',

            id:
              request.id,

            functionName:
              request.functionName,

            args:
              request.args
          },
          '*'
        );

    }

  }


  // ==================================================
  // GOOGLE.SCRIPT.RUN COMPATIBILITY
  // ==================================================

  function createRunner(
    successHandler,
    failureHandler
  ) {

    return new Proxy(
      {},
      {

        get(
          target,
          property
        ) {

          if (
            property ===
            'withSuccessHandler'
          ) {

            return function (
              handler
            ) {

              return createRunner(
                handler,
                failureHandler
              );

            };

          }


          if (
            property ===
            'withFailureHandler'
          ) {

            return function (
              handler
            ) {

              return createRunner(
                successHandler,
                handler
              );

            };

          }


          return function (
            ...args
          ) {

            const id =
              String(
                nextId++
              );


            const request = {

              id:
                id,

              functionName:
                String(
                  property
                ),

              args:
                args,

              success:
                successHandler,

              failure:
                failureHandler

            };


            pending.set(
              id,
              request
            );


            sendRequest(
              request
            );

          };

        }

      }
    );

  }


  window.google =
    window.google || {};


  window.google.script =
    window.google.script || {};


  window.google.script.run =
    createRunner(
      null,
      null
    );


  // ==================================================
  // CONNECTION ERROR
  // ==================================================

  function showConnectionError() {

    console.error(
      'Sprite Locker could not connect to Apps Script.'
    );


    const error =
      document.getElementById(
        'loginError'
      );


    if (error) {

      error.textContent =
        'Could not connect to Sprite Locker data.';

    }

  }


  // ==================================================
  // START
  // ==================================================

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      createBridge
    );

  } else {

    createBridge();

  }

})();
