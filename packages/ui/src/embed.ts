import type { Message } from './post-message';

if (!document.currentScript || !('src' in document.currentScript)) {
  throw new Error('Unknown script URL');
}

const currentScript = new URL(document.currentScript.src);

const iframes = new WeakMap<MessageEventSource, HTMLIFrameElement>();

let iframeCreated = false; // Flag global para proteger contra múltiplas execuções

function onDOMContentLoaded(callback: () => void) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
}

onDOMContentLoaded(function () {
  // Proteção contra múltiplas execuções
  if (iframeCreated) {
    console.log("Iframe já criado, abortando a criação duplicada.");
    return;
  }

  const wizards = document.querySelectorAll<HTMLElement>('oz-wizard');
  console.log("Found oz-wizard elements:", wizards);

  if (wizards.length > 0) {
    const w = wizards[0];
    console.log('w', w);

    if (w) {
      // Verifique se já existe um iframe dentro do elemento oz-wizard e o remova
      const existingIframe = w.querySelector('iframe');
      if (existingIframe) {
        console.log("Removing existing iframe:", existingIframe);
        w.removeChild(existingIframe);
      }

      w.style.display = 'block';

      const src = new URL('embed', currentScript.origin);

      setSearchParam(w, src.searchParams, 'data-lang', 'lang');
      setSearchParam(w, src.searchParams, 'data-tab', 'tab');
      setSearchParam(w, src.searchParams, 'version', 'version');
      const sync = w.getAttribute('data-sync-url');

      if (sync === 'fragment') {
        const fragment = window.location.hash.replace('#', '');
        if (fragment) {
          src.searchParams.set('tab', fragment);
        }
      }

      const iframe = document.createElement('iframe');
      iframe.src = src.toString();
      iframe.style.display = 'block';
      iframe.style.border = '0';
      iframe.style.width = '100%';
      iframe.style.height = 'calc(100vh - 158px)';

      w.appendChild(iframe);
      console.log("Appended new iframe:", iframe);

      if (iframe.contentWindow !== null) {
        iframes.set(iframe.contentWindow, iframe);
      }

      // Marca que o iframe foi criado para evitar execuções futuras
      iframeCreated = true;

      if (sync === 'fragment') {
        window.addEventListener('message', (e: MessageEvent<Message>) => {
          if (e.source && e.data.kind === 'oz-wizard-tab-change') {
            if (iframe === iframes.get(e.source)) {
              window.location.hash = e.data.tab;
              console.log("Updated URL fragment:", e.data.tab);
            }
          }
        });
      }
    } else {
      console.error('No oz-wizard element found.');
    }
  } else {
    console.error('No oz-wizard elements found in the document.');
  }
});

function setSearchParam(w: HTMLElement, searchParams: URLSearchParams, dataParam: string, param: string) {
  const value = w.getAttribute(dataParam) ?? w.getAttribute(param);
  if (value) {
    searchParams.set(param, value);
  }
}

export { };
