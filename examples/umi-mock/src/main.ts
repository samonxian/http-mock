import './style.css';

const newFetch = (url: string, ...args: any[]) => {
  return fetch(url, ...args).then(async (response) => {
    return response.json();
  });
};

const fetch1 = newFetch('/api/v1/topic/2?name=samon');
const fetch2 = newFetch('/api/v1/topic/2?name=samon', { method: 'DELETE' });
const fetch3 = newFetch('/api/v1/topic/2?name=samon', {
  method: 'POST',
  body: JSON.stringify({ title: 'title', content: 'content' }),
});
const fetch4 = newFetch('/api/v1/topic/2?name=samon', {
  method: 'PATCH',
  body: JSON.stringify({ title: 'title', content: 'content' }),
});
const fetch5 = newFetch('/api/v1/topic/2?name=samon', {
  method: 'PUT',
  body: JSON.stringify({ title: 'title', content: 'content' }),
});

Promise.all([fetch1, fetch2, fetch3, fetch4, fetch5]).then((result) => {
  result.forEach((r) => {
    const div = document.createElement('div');
    div.innerHTML = `
<h3>${r.method}: ${r.url}</h3>
<textarea >
${JSON.stringify(r, null, 2)}
</textarea>
    `;
    document.querySelector<HTMLDivElement>('#app')?.append(div);
  });
});
