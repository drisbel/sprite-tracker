/*
  SPRITE LOCKER — GITHUB -> APPS SCRIPT BRIDGE
  Replace the URL only if your Apps Script deployment URL changes.
*/

const SPRITE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby16GaDfmsl0w9DnseX2OSmGfoOw2Mp29EiBfbeGtizLVEGtopcNMmhHT67kcSWxADdYQ/exec';


(function () {

  let bridgeFrame = null;
  let bridgeReady = false;
  let bridgeOrigin = null;
  let nextId = 1;
  let readyTimer = null;

  const pending = new Map();
  const queue = [];


  function bridgeUrl_() {

    const separator =
      SPRITE_APPS_SCRIPT_URL.includes('?')
        ? '&'
        : '?';

    return (
      SPRITE_APPS_SCRIPT_URL +
      separator +
      'bridge=1&parentOrigin=' +
      encodeURIComponent(
        window.location.origin
      )
    );

  }


  function showBridgeError_(message) {

    console.error(
      '[Sprite Locker Bridge]',
      message
    );

    const loginError =
      document.getElementById(
        'loginError'
      );

    if (loginError) {

      loginError.textContent =
        'Could not connect to Sprite Locker data. ' +
        'Refresh the page and try again.';

    }

  }


  function ensureBridge_() {

    if (bridgeFrame) {
      return;
    }


    bridgeFrame =
      document.createElement(
        'iframe'
      );


    bridgeFrame.id =
      'spriteAppsScriptBridge';


    bridgeFrame.src =
      bridgeUrl_();


    bridgeFrame.style.cssText =
      'position:fixed;' +
      'left:-9999px;' +
      'top:-9999px;' +
      'width:2px;' +
      'height:2px;' +
      'border:0;' +
      'opacity:0;' +
      'pointer-events:none;';


    bridgeFrame.setAttribute(
      'aria-hidden',
      'true'
    );


    bridgeFrame.onload =
      function () {

        try {

          bridgeFrame
            .contentWindow
            .postMessage(
              {
                spriteLockerBridge:
                  true,

                type:
                  'parent-ready',

                parentOrigin:
                  window.location.origin
              },
              '*'
            );

        } catch (error) {

          console.error(
            error
          );

        }

      };


    document.body.appendChild(
      bridgeFrame
    );


    readyTimer =
      setTimeout(
        function () {

          if (!bridgeReady) {

            showBridgeError_(
              'Apps Script bridge did not become ready.'
            );

          }

        },
        12000
      );

  }


  function dispatch_(call) {

    if (
      !bridgeReady ||
      !bridgeFrame ||
      !bridgeFrame.contentWindow
    ) {

      queue.push(
        call
      );

      ensureBridge_();

      return;

    }


    bridgeFrame
      .contentWindow
      .postMessage(
        {
          spriteLockerBridge:
            true,

          type:
            'call',

          id:
            call.id,

          functionName:
            call.functionName,

          args:
            call.args
        },
        bridgeOrigin || '*'
      );

  }


  function flushQueue_() {

    while (
      bridgeReady &&
      queue.length
    ) {

      dispatch_(
        queue.shift()
      );

    }

  }


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
        Only accept messages from the
        Apps Script bridge iframe.
      */

      if (
        bridgeFrame &&
        event.source !==
          bridgeFrame.contentWindow
      ) {
        return;
      }


      if (
        data.type ===
        'ready'
      ) {

        bridgeOrigin =
          event.origin;


        bridgeReady =
          true;


        if (readyTimer) {

          clearTimeout(
            readyTimer
          );

          readyTimer =
            null;

        }


        flushQueue_();

        return;

      }


      if (
        data.type !==
        'result'
      ) {
        return;
      }


      const call =
        pending.get(
          String(
            data.id
          )
        );


      if (!call) {
        return;
      }


      pending.delete(
        String(
          data.id
        )
      );


      if (data.ok) {

        if (call.success) {

          call.success(
            data.value
          );

        }

        return;

      }


      const error =
        new Error(
          data.error ||
          'Server request failed.'
        );


      if (call.failure) {

        call.failure(
          error
        );

      } else {

        console.error(
          error
        );

      }

    }
  );


  function makeRunner_(
    successHandler,
    failureHandler
  ) {

    return new Proxy(
      {},
      {

        get:
          function (
            _target,
            property
          ) {

            if (
              property ===
              'withSuccessHandler'
            ) {

              return function (fn) {

                return makeRunner_(
                  fn,
                  failureHandler
                );

              };

            }


            if (
              property ===
              'withFailureHandler'
            ) {

              return function (fn) {

                return makeRunner_(
                  successHandler,
                  fn
                );

              };

            }


            return function (...args) {

              const id =
                String(
                  nextId++
                );


              const call = {

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
                call
              );


              dispatch_(
                call
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
    makeRunner_(
      null,
      null
    );


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      ensureBridge_
    );

  } else {

    ensureBridge_();

  }

})();
