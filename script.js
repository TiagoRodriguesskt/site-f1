/*
* SCRIPT COMPLETO DO SITE F1
* * Funcionalidades:
* 1. Feed de Notícias (RSS da F1 c/ proxy)
* 2. Modal Híbrido (RSS + "Scraping" da matéria)
* 3. Contagem Regressiva (Automática com API OpenF1)
* 4. Pódio e Pontuação (Automático com API OpenF1)
* 5. Player de Áudio (com volume)
*/

// -----------------------------------------------------------------
// 1. INICIALIZADOR PRINCIPAL
// -----------------------------------------------------------------
// 'DOMContentLoaded' espera o HTML ser carregado para rodar o JS
document.addEventListener('DOMContentLoaded', () => {
fetchF1News(); // Carrega as notícias
fetchCountdownData(); // Carrega o contador
fetchStandingsData(); // Carrega a pontuação
setupAudioPlayer(); // Configura o áudio
setupModalClose(); // Configura o fechamento do modal
});


// -----------------------------------------------------------------
// 2. FEED DE NOTÍCIAS (RSS)
// -----------------------------------------------------------------
async function fetchF1News() {
const feedUrl = 'https://www.formula1.com/en/latest/all.xml';
const apiUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;

const container = document.getElementById('feed-noticias');
const descParser = new DOMParser();

try {
container.innerHTML = '<p class="loading">Carregando as últimas notícias da F1...</p>';
const response = await fetch(apiUrl);
if (!response.ok) throw new Error(`Erro HTTP! Status: ${response.status}`);

const xmlText = await response.text();
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(xmlText, "application/xml");

const errorNode = xmlDoc.querySelector("parsererror");
if (errorNode) throw new Error("Erro ao interpretar o feed RSS da F1.");

const items = xmlDoc.querySelectorAll("item");
container.innerHTML = '';
if (items.length === 0) {
container.innerHTML = '<p class="loading">Nenhuma notícia encontrada no feed.</p>';
return;
}

items.forEach(item => {
const title = item.querySelector("title")?.textContent || "Título Indisponível";
const link = item.querySelector("link")?.textContent || "#";
const descriptionHTML = item.querySelector("description")?.textContent || "";

const descDoc = descParser.parseFromString(descriptionHTML, "text/html");
const imgElement = descDoc.querySelector("img");

const imageUrl = imgElement ? imgElement.src : 'https://upload.wikimedia.org/wikipedia/commons/3/3f/F1_logo.svg';
const summaryText = descDoc.body.textContent || "(Sem resumo disponível)";

const itemHtml = document.createElement('div');
itemHtml.classList.add('noticia-item');

itemHtml.innerHTML = `
<h2 class="clickable-title">
${title}
</h2>
<p>${summaryText.substring(0, 150)}...</p>
`;

// Adiciona o clique para abrir o Modal
const clickableTitle = itemHtml.querySelector('h2');
clickableTitle.addEventListener('click', () => {
openModal(title, imageUrl, summaryText, link);
});

container.appendChild(itemHtml);
});

} catch (error) {
console.error('Erro detalhado ao carregar notícias:', error);
container.innerHTML = `<p class="loading" style="color: red;">Ocorreu um erro ao carregar as notícias. (Rede ou Proxy falhou).</p>`;
}

// Recarrega as notícias a cada 5 minutos
setInterval(fetchF1News, 300000);
}


// -----------------------------------------------------------------
// 3. LÓGICA DO MODAL (Híbrido)
// -----------------------------------------------------------------
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('modal-image');
const modalText = document.getElementById('modal-text');
const modalLink = document.getElementById('modal-link');
const modalCloseBtn = document.getElementById('modal-close-btn');

async function openModal(title, imageUrl, summaryText, newsLink) {
modalOverlay.classList.add('active');

// 1. Preenche o modal IMEDIATAMENTE com os dados do RSS
modalTitle.textContent = title;
modalImage.src = imageUrl;
modalImage.alt = title;
modalImage.style.display = 'block';
modalLink.href = newsLink;
modalText.innerHTML = '<p style="font-style: italic;">Carregando matéria completa...</p>';

try {
// 2. TENTA buscar a matéria completa (Scraping)
const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(newsLink)}`;
const response = await fetch(proxiedUrl);
if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

const htmlText = await response.text();
const parser = new DOMParser();
const doc = parser.parseFromString(htmlText, "text/html");

const articleBody = doc.querySelector('.f1-article--body');

if (articleBody) {
const tempDiv = document.createElement('div');
tempDiv.innerHTML = articleBody.innerHTML;
tempDiv.querySelectorAll('a[href^="/"], button, .f-modal, .f1-button').forEach(el => el.remove());
modalText.innerHTML = tempDiv.innerHTML;
} else {
throw new Error("Não foi possível encontrar o corpo do artigo (layout mudou).");
}
} catch (error) {
// 3. SE FALHAR, usa o resumo do RSS (Fallback)
console.warn('Falha ao buscar matéria completa, usando resumo:', error.message);
modalText.innerHTML = `<p>${summaryText}</p>`;
}
}

function closeModal() {
modalOverlay.classList.remove('active');
modalTitle.textContent = "";
modalImage.src = "";
modalText.innerHTML = "";
modalImage.style.display = 'none';
}

function setupModalClose() {
modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (event) => {
if (event.target === modalOverlay) {
closeModal();
}
});
}


// -----------------------------------------------------------------
// 4. LÓGICA DA CONTAGEM REGRESSIVA (OpenF1)
// -----------------------------------------------------------------
let countdownInterval = null;

async function fetchCountdownData() {
const raceNameEl = document.getElementById('race-name');
const countdownEl = document.getElementById('countdown');
const titleEl = document.getElementById('countdown-title');

try {
const today = new Date().toISOString().split('T')[0];
// API OpenF1 (jolpica): Busca a próxima sessão "Race"
const response = await fetch(`https://api.openf1.org/v1/sessions?session_name=Race&date_start>=${today}&order=date_start&limit=1`);

if (!response.ok) throw new Error('Não foi possível buscar dados da OpenF1 API');
const data = await response.json();

if (!data || data.length === 0) {
throw new Error('Não há mais corridas nesta temporada (OpenF1).');
}

const nextRace = data[0];
const raceName = nextRace.meeting_name;
const targetDateTime = new Date(nextRace.date_start);

raceNameEl.textContent = raceName;
startCountdown(targetDateTime, countdownEl, titleEl);

} catch (error) {
console.error('Erro ao buscar próxima corrida (OpenF1):', error);
raceNameEl.textContent = 'Temporada Concluída!';
if (countdownEl) countdownEl.innerHTML = '';
}
}

function startCountdown(targetDate, countdownEl, titleEl) {
if (countdownInterval) clearInterval(countdownInterval);

const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');

function updateTime() {
const now = new Date().getTime();
const distance = targetDate.getTime() - now;

if (distance < 0) {
clearInterval(countdownInterval);
titleEl.textContent = 'A CORRIDA ESTÁ ACONTECENDO!';
countdownEl.innerHTML = '<p style="font-size: 1.2em; color: var(--rb-red); font-weight: 700;">É HORA DAS LUZES SE APAGAREM!</p>';
return;
}

const days = Math.floor(distance / (1000 * 60 * 60 * 24));
const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
const seconds = Math.floor((distance % (1000 * 60)) / 1000);

daysEl.textContent = formatTime(days);
hoursEl.textContent = formatTime(hours);
minutesEl.textContent = formatTime(minutes);
secondsEl.textContent = formatTime(seconds);
}

updateTime(); // Chama uma vez imediatamente
countdownInterval = setInterval(updateTime, 1000);
}

function formatTime(time) {
return time < 10 ? `0${time}` : time;
}


// -----------------------------------------------------------------
// 5. LÓGICA DE PÓDIO E PONTUAÇÃO (OpenF1)
// -----------------------------------------------------------------
async function fetchStandingsData() {
const container = document.getElementById('standings-section');
container.innerHTML = '<p class="loading-standings">Carregando dados de pontuação...</p>';

try {
// 1. Buscar a Pontuação (Standings)
const standingsResponse = await fetch(`https://api.openf1.org/v1/driver_standings?session_key=latest`);
if (!standingsResponse.ok) throw new Error('Falha ao buscar pontuação (OpenF1)');
const standingsData = await standingsResponse.json();

// 2. Buscar a Última Corrida (para saber o nome e a 'key')
const today = new Date().toISOString();
const lastSessionResponse = await fetch(`https://api.openf1.org/v1/sessions?session_name=Race&date_end<=${today}&order=date_start&limit=1`);
if (!lastSessionResponse.ok) throw new Error('Falha ao buscar última sessão (OpenF1)');
const lastSession = await lastSessionResponse.json();

let sessionKey = null;
let lastRaceName = "Última Corrida";
if (lastSession && lastSession.length > 0) {
sessionKey = lastSession[0].session_key;
lastRaceName = lastSession[0].meeting_name;
} else {
// Fallback se a temporada 2025 ainda não começou (mostra a última de 2024)
const fallbackSession = await fetch(`https://api.openf1.org/v1/sessions?session_name=Race&year=2024&order=date_start&limit=1`);
const fallbackData = await fallbackSession.json();
sessionKey = fallbackData[fallbackData.length - 1].session_key; // Pega a *última* de 2024
lastRaceName = fallbackData[fallbackData.length - 1].meeting_name;
}

// 3. Buscar o Pódio (Resultado) daquela corrida
const resultsResponse = await fetch(`https://api.openf1.org/v1/position?session_key=${sessionKey}&position<=3&order=position`);
if (!resultsResponse.ok) throw new Error('Falha ao buscar resultados (OpenF1)');
const resultsData = await resultsResponse.json();

// 4. Buscar nomes/equipes (OpenF1 separa os dados)
const podiumData = [];
for (const driver of resultsData) {
const driverInfoResponse = await fetch(`https://api.openf1.org/v1/drivers?driver_number=${driver.driver_number}&session_key=${sessionKey}`);
const driverInfo = await driverInfoResponse.json();
if(driverInfo && driverInfo.length > 0) {
podiumData.push({
...driver,
first_name: driverInfo[0].first_name,
last_name: driverInfo[0].last_name,
team_name: driverInfo[0].team_name
});
}
}

// 5. Construir o HTML
const standingsHTML = `
<div class="widget">
<h3 class="widgetTitle">Pontuação (Pilotos Top 5)</h3>
<ol class="standingsList">
${standingsData.slice(0, 5).map(driver => `
<li>
<span class="position">${driver.position}</span>
<span class="driverName">${driver.first_name} <strong>${driver.last_name}</strong></span>
<span class="constructorName">${driver.team_name}</span>
<span class="points">${driver.points} pts</span>
</li>
`).join('')}
</ol>
</div>
`;

const podiumHTML = `
<div class="widget">
<h3 class="widgetTitle">Última Corrida: ${lastRaceName}</h3>
<ol class="podiumList">
${podiumData.map(driver => `
<li>
<span class="position">${driver.position}</span>
<span class="driverName">${driver.first_name} <strong>${driver.last_name}</strong></span>
<span class="constructorName">${driver.team_name}</span>
</li>
`).join('')}
</ol>
</div>
`;

// 6. Inserir no HTML
container.innerHTML = standingsHTML + podiumHTML;

} catch (err) {
console.error("Erro ao buscar dados de pódio/pontuação:", err);
container.innerHTML = `<p class="loading-error-standings">Não foi possível carregar os dados de pontuação. A API pode estar offline.</p>`;
}
}


// -----------------------------------------------------------------
// 6. LÓGICA DO PLAYER DE ÁUDIO
// -----------------------------------------------------------------
function setupAudioPlayer() {
const audio = document.getElementById('bg-audio');
const muteBtn = document.getElementById('mute-btn');
const iconOn = document.getElementById('icon-on');
const iconOff = document.getElementById('icon-off');

if (!audio || !muteBtn || !iconOn || !iconOff) return; // Segurança

audio.volume = 0.2; // Volume em 20%
let audioReady = false;

audio.play().then(() => {
audioReady = true;
}).catch(e => {
console.warn("Autoplay mudo falhou, usuário precisa interagir.");
});

async function toggleMute() {
if (!audioReady) {
try {
await audio.play();
audioReady = true;
} catch (err) {
console.error("Usuário clicou, mas o áudio falhou:", err);
return;
}
}
if (audio.muted) {
audio.muted = false;
iconOn.style.display = 'block';
iconOff.style.display = 'none';
} else {
audio.muted = true;
iconOn.style.display = 'none';
iconOff.style.display = 'block';
}
}

muteBtn.addEventListener('click', toggleMute);

if (audio.muted) {
iconOn.style.display = 'none';
iconOff.style.display = 'block';
}
}
