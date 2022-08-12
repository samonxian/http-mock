import './style.css';
import typescriptLogo from './typescript.svg';
import { setupCounter } from './counter';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`;

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!);

fetch('/api/v1/topic/2?name=samon')
  .then(async (response) => {
    return response.json();
  })
  .then((result) => {
    console.log(result);
  });

fetch('/api/v1/topic/2?a=2', { method: 'POST', body: JSON.stringify({ params: { test: 2 } }) })
  .then(async (response) => {
    return response.json();
  })
  .then((result) => {
    console.log(result);
  });
