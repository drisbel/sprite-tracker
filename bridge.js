/*
  Sprite Locker GitHub -> Apps Script bridge

  STEP 1:
  Paste your deployed Apps Script /exec URL below.
*/
const SPRITE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby16GaDfmsl0w9DnseX2OSmGfoOw2Mp29EiBfbeGtizLVEGtopcNMmhHT67kcSWxADdYQ/exec';

(function () {
  let bridgeReady = false;
  let bridgeFrame = null;
  let nextId = 1;
  const pending = new Map();
  const queued = [];

  function ensureBridge() {
    if (bridgeFrame) return;

    if (
      !SPRITE_APPS_SCRIPT_URL ||
      SPRITE_APPS_SCRIPT_URL.includes('PASTE_YOUR_')
    ) {
      console.error('Set SPRITE_APPS_SCRIPT_URL in bridge.js first.');
      return;
    }

    bridgeFrame = document.createElement('iframe');
    bridgeFrame.src =
      SPRITE_APPS_SCRIPT_URL +
      (SPRITE_APPS_SCRIPT_URL.includes('?') ? '&' : '?') +
      'bridge=1';

    bridgeFrame.style.position = 'fixed';
    bridgeFrame.style.width = '1px';
    bridgeFrame.style.height = '1px';
    bridgeFrame.style.opacity = '0';
    bridgeFrame.style.pointerEvents = 'none';
    bridgeFrame.style.border = '0';
    bridgeFrame.setAttribute('aria-hidden', 'true');

    document.body.appendChild(bridgeFrame);
  }

  function sendCall(call) {
    if (!bridgeReady || !bridgeFrame || !bridgeFrame.contentWindow) {
      queued.push(call);
      ensureBridge();
      return;
    }

    bridgeFrame.contentWindow.postMessage(
      {
        spriteLockerBridge: true,
        type: 'call',
        id: call.id,
        functionName: call.functionName,
        args: call.args
      },
      '*'
    );
  }

  window.addEventListener('message', event => {
    const data = event.data || {};
    if (!data.spriteLockerBridge) return;

    if (data.type === 'ready') {
      bridgeReady = true;
      while (queued.length) sendCall(queued.shift());
      return;
    }

    if (data.type !== 'result') return;

    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);

    if (data.ok) {
      if (call.success) call.success(data.value);
    } else {
      const error = new Error(data.error || 'Server request failed.');
      if (call.failure) call.failure(error);
      else console.error(error);
    }
  });

  function makeRunner(success, failure) {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'withSuccessHandler') {
            return fn => makeRunner(fn, failure);
          }

          if (prop === 'withFailureHandler') {
            return fn => makeRunner(success, fn);
          }

          return (...args) => {
            const call = {
              id: String(nextId++),
              functionName: String(prop),
              args,
              success,
              failure
            };

            pending.set(call.id, call);
            sendCall(call);
          };
        }
      }
    );
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null);

  window.addEventListener('DOMContentLoaded', ensureBridge);
})();
