import './styles/global.css';

import type { } from 'svelte';
import App from './App.svelte';

// function postResize() {
//   const { height } = document.documentElement.getBoundingClientRect();
//   postMessage({ kind: 'oz-wizard-resize', height });
// }

// window.onload = postResize;

// const resizeObserver = new ResizeObserver(postResize);
// resizeObserver.observe(document.body);

const params = new URLSearchParams(window.location.search);

const initialTab = params.get('tab') ?? undefined;

let app;
app = new App({ target: document.body, props: { initialTab } });

export default app;

