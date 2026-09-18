/*
  SPRITE LOCKER — GITHUB -> APPS SCRIPT JSONP API

  This file intentionally keeps a google.script.run-compatible interface
  so the existing desktop.js/mobile.js code does not need to be rewritten.

  GitHub Pages loads this file directly. No iframe is used.
*/

const SPRITE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycby16GaDfmsl0w9DnseX2OSmGfoOw2Mp29EiBfbeGtizLVEGtopcNMmhHT67kcSWxADdYQ/exec';

(function () {
  let nextId = 1;

  function callApi_(functionName, args, successHandler, failureHandler) {
    const id = nextId++;
    const callbackName =
      '__spriteLockerRpc_' +
      Date.now() +
      '_' +
      id;

    const script =
      document.createElement('script');

    let finished = false;

    const timer = setTimeout(
      function () {
        finishError_(
          new Error(
            'Sprite Locker server request timed out.'
          )
        );
      },
      20000
    );

    function cleanup_() {
      clearTimeout(timer);

      try {
        delete window[callbackName];
      } catch (error) {
        window[callbackName] = undefined;
      }

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    function finishError_(error) {
      if (finished) return;
      finished = true;
      cleanup_();

      if (failureHandler) {
        failureHandler(error);
      } else {
        console.error(error);
      }
    }

    window[callbackName] = function (payload) {
      if (finished) return;
      finished = true;
      cleanup_();

      if (payload && payload.ok) {
        if (successHandler) {
          successHandler(payload.value);
        }
        return;
      }

      const error =
        new Error(
          payload && payload.error
            ? payload.error
            : 'Server request failed.'
        );

      if (failureHandler) {
        failureHandler(error);
      } else {
        console.error(error);
      }
    };

    script.onerror = function () {
      finishError_(
        new Error(
          'Could not connect to the Sprite Locker server.'
        )
      );
    };

    const separator =
      SPRITE_APPS_SCRIPT_URL.includes('?')
        ? '&'
        : '?';

    const query = [
      'api=1',
      'action=' + encodeURIComponent(functionName),
      'args=' + encodeURIComponent(JSON.stringify(args || [])),
      'callback=' + encodeURIComponent(callbackName),
      '_=' + Date.now() + '-' + id
    ].join('&');

    script.src =
      SPRITE_APPS_SCRIPT_URL +
      separator +
      query;

    document.head.appendChild(script);
  }

  function makeRunner_(successHandler, failureHandler) {
    return new Proxy(
      {},
      {
        get: function (_target, property) {
          if (property === 'withSuccessHandler') {
            return function (fn) {
              return makeRunner_(fn, failureHandler);
            };
          }

          if (property === 'withFailureHandler') {
            return function (fn) {
              return makeRunner_(successHandler, fn);
            };
          }

          // Prevent Promise/introspection machinery from treating this as thenable.
          if (
            property === 'then' ||
            property === 'catch' ||
            property === 'finally'
          ) {
            return undefined;
          }

          return function () {
            callApi_(
              String(property),
              Array.from(arguments),
              successHandler,
              failureHandler
            );
          };
        }
      }
    );
  }

  // Recreate the part of google.script.run used by the existing frontend.
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  Object.defineProperty(
    window.google.script,
    'run',
    {
      configurable: true,
      enumerable: true,
      get: function () {
        return makeRunner_(null, null);
      }
    }
  );
})();
