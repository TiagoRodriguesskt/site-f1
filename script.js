/* --- FUNÇÃO PRINCIPAL DE BUSCAR NOTÍCIAS (VERSÃO 3.0 - Híbrida) --- */
async function fetchF1News() {
    // API (via proxy) para o feed de notícias
    const feedUrl = 'https://www.formula1.com/en/latest/all.xml';
    const apiUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
    
    const container = document.getElementById('feed-noticias');
    const descParser = new DOMParser(); // Parser para o HTML da descrição

    try {
        container.innerHTML = '<p class="loading">Carregando as últimas notícias da F1...</p>';
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Erro HTTP! Status: ${response.status}`);
        }

        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        // Verifica se o XML é válido
        const errorNode = xmlDoc.querySelector("parsererror");
        if (errorNode) {
            throw new Error("Erro ao interpretar o feed RSS da F1.");
        }

        const items = xmlDoc.querySelectorAll("item");
        container.innerHTML = ''; // Limpa o "Carregando..."

        if (items.length === 0) {
            container.innerHTML = '<p class="loading">Nenhuma notícia encontrada no feed.</p>';
            return;
        }

        // Loop por cada notícia no RSS
        items.forEach(item => {
            // 1. Extrai TUDO do RSS
            const title = item.querySelector("title")?.textContent || "Título Indisponível";
            const link = item.querySelector("link")?.textContent || "#";
            const descriptionHTML = item.querySelector("description")?.textContent || "";

            // 2. Processa a descrição do RSS para pegar a imagem e o resumo
            const descDoc = descParser.parseFromString(descriptionHTML, "text/html");
            const imgElement = descDoc.querySelector("img");
            
            const imageUrl = imgElement ? imgElement.src : 'https://upload.wikimedia.org/wikipedia/commons/3/3f/F1_logo.svg'; // Imagem de fallback
            const summaryText = descDoc.body.textContent || "(Sem resumo disponível)"; // Texto de fallback

            // 3. Cria o item da lista
            const itemHtml = document.createElement('div');
            itemHtml.classList.add('noticia-item');
            
            itemHtml.innerHTML = `
                <h2 class="clickable-title">
                    ${title}
                </h2>
                <p>${summaryText.substring(0, 150)}...</p> 
            `;

            // 4. Adiciona o clique para abrir o Modal
            itemHtml.addEventListener('click', () => {
                // Passa TODOS os dados do RSS para o modal
                openModal(title, imageUrl, summaryText, link); 
            });
            
            container.appendChild(itemHtml);
        });

    } catch (error) {
        console.error('Erro detalhado ao carregar notícias:', error);
        container.innerHTML = `<p class="loading" style="color: red;">Ocorreu um erro ao carregar as notícias. (Rede ou Proxy falhou).</p>`;
    }
}

// Recarrega as notícias a cada 5 minutos
setInterval(fetchF1News, 300000);


/* --- LÓGICA DO MODAL (VERSÃO 3.0 - Híbrida / Robusta) --- */

// Pega os elementos do Modal
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalImage = document.getElementById('modal-image');
const modalText = document.getElementById('modal-text');
const modalLink = document.getElementById('modal-link');
const modalCloseBtn = document.getElementById('modal-close-btn');

// Função para ABRIR o Modal
async function openModal(title, imageUrl, summaryText, newsLink) {
    modalOverlay.classList.add('active'); // Mostra o overlay

    // 1. Preenche o modal IMEDIATAMENTE com os dados do RSS
    modalTitle.textContent = title;
    modalImage.src = imageUrl;
    modalImage.alt = title;
    modalImage.style.display = 'block';
    modalLink.href = newsLink;
    
    // 2. Mostra o feedback de carregamento para o texto
    modalText.innerHTML = '<p style="font-style: italic;">Carregando matéria completa...</p>';

    try {
        // 3. TENTA buscar a matéria completa (Scraping)
        const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(newsLink)}`;
        const response = await fetch(proxiedUrl);

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`); // Falha na rede
        }

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");

        // 4. TENTA encontrar o corpo do artigo
        const articleBody = doc.querySelector('.f1-article--body'); 

        if (articleBody) {
            // 5. SUCESSO! Limpa o corpo e insere no modal
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = articleBody.innerHTML;
            
            tempDiv.querySelectorAll('a[href^="/"], button, .f-modal, .f1-button').forEach(el => el.remove());
            
            modalText.innerHTML = tempDiv.innerHTML;
        } else {
            // 6. FALHA (Não achou o seletor)
            throw new Error("Não foi possível encontrar o corpo do artigo (layout mudou).");
        }

    } catch (error) {
        // 7. SE QUALQUER COISA FALHAR (Rede ou Scraping)
        console.warn('Falha ao buscar matéria completa, usando resumo:', error.message);
        // Não mostramos erro! Apenas usamos o resumo do RSS
        modalText.innerHTML = `<p>${summaryText}</p>`;
    }
}

// Função para FECHAR o Modal
function closeModal() {
    modalOverlay.classList.remove('active');
    modalTitle.textContent = "";
    modalImage.src = "";
    modalImage.alt = "";
    modalText.innerHTML = "";
    modalImage.style.display = 'none';
}

// Adiciona os "escutadores" de clique para fechar
modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
        closeModal();
    }
});


/* --- LÓGICA DA CONTAGEM REGRESSIVA (VERSÃO 5.0 - AUTOMÁTICA INTELIGENTE) --- */

let countdownInterval = null; // Variável para controlar o timer

// 1. Função que busca a data da próxima corrida
async function fetchNextRace() {
    
    // API da Ergast (agora com HTTPS e buscando o CALENDÁRIO COMPLETO DE 2025)
    const raceApiUrl = 'https://ergast.com/api/f1/2025.json'; 
    
    try {
        // FAZEMOS O FETCH DIRETAMENTE NA API DE CORRIDAS
        const response = await fetch(raceApiUrl); 
        
        if (!response.ok) throw new Error('Não foi possível buscar o calendário 2025.');
        
        const data = await response.json(); 
        const races = data.MRData.RaceTable.Races; // Esta é a LISTA de corridas

        if (!races || races.length === 0) {
            throw new Error('Calendário de 2025 não encontrado na API.');
        }

        // Pega a data/hora de AGORA
        const now = new Date();
        let targetRace = null; // Variável para guardar a próxima corrida

        // O "CÉREBRO": Loopa pela lista de corridas
        for (const race of races) {
            const raceDate = race.date; // Ex: "2025-11-07"
            // (Usamos "00:00:00Z" (meia-noite) como fallback se a API não der a hora)
            const raceTime = race.time || "00:00:00Z"; 

            // Combina data e hora para criar a data exata da largada (em UTC)
            const targetDateTime = new Date(`${raceDate}T${raceTime}`);
            
            // COMPARA: A data da corrida é no futuro?
            if (targetDateTime > now) {
                // SIM! Achamos a próxima corrida.
                targetRace = race;
                break; // Para o loop
            }
        }

        // Processa o resultado
        if (targetRace) {
            // Achamos uma corrida futura!
            const raceName = targetRace.raceName;
            const targetDateTime = new Date(`${targetRace.date}T${targetRace.time}`);

            document.getElementById('race-name').textContent = raceName;
            startCountdown(targetDateTime); // Inicia o contador
        } else {
            // O loop terminou e não achou corridas futuras
            throw new Error('Não há mais corridas nesta temporada (2025).');
        }

    } catch (error) {
        console.error('Erro ao buscar próxima corrida:', error);
        
        // SE A TEMPORADA TIVER ACABADO, VAI MOSTRAR ISSO:
        document.getElementById('race-name').textContent = 'Temporada Concluída!';
        document.getElementById('countdown').innerHTML = ''; // Limpa os "00 00 00 00"
    }
}

// 2. Função que atualiza o contador a cada segundo
function startCountdown(targetDate) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    const countdownEl = document.getElementById('countdown');
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const titleEl = document.getElementById('countdown-title');

    updateTime(); // Chama uma vez imediatamente
    countdownInterval = setInterval(updateTime, 1000); 

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
}

// 3. Função auxiliar para adicionar um '0' (ex: 9 -> 09)
function formatTime(time) {
    return time < 10 ? `0${time}` : time;
}

// 4. Inicia tudo!
fetchNextRace(); // Inicia o contador
fetchF1News();  // Inicia o feed de notícias


/* --- LÓGICA DO BOTÃO DE MUDO (VERSÃO 2.1 - COM VOLUME) --- */
const audio = document.getElementById('bg-audio');
const muteBtn = document.getElementById('mute-btn');
const iconOn = document.getElementById('icon-on');
const iconOff = document.getElementById('icon-off');

audio.volume = 0.2; // Volume em 20%
let audioReady = false;

audio.play().then(() => {
    audioReady = true;
}).catch(e => {
    console.warn("Autoplay mudo falhou, mas tudo bem.");
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
