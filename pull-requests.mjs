async function renderPullRequests() {
  const response = await fetch('./data.json');
  const data = await response.json();

  let content = "";
  for (const prNumber of Object.keys(data.pullRequests).sort((a, b) => Number(b) - Number(a))) {
    const prData = data.pullRequests[prNumber];
    const baseURL = `${location.href.substring(0, location.href.lastIndexOf('/'))}/testrun.html`;
    content += `
      <div class="pull-request">
        <a href="${baseURL}?browser=firefox&pr=${prNumber}">Firefox</a>
        <a href="${baseURL}?browser=chrome&pr=${prNumber}">Chrome</a>
        <span><a href="https://github.com/microsoft/playwright/pull/${prNumber}" target="_blank">#${prNumber}</a> - ${prData.title}</span>
      </div>
    `;
  }

  document.getElementById('table').innerHTML = content;
}

renderPullRequests();
