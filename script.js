// Inizializzazione di SQL.js
let SQL;
let db;

// Funzione per salvare il database nel localStorage
function saveDatabase() {
    try {
        const data = db.export();
        const buffer = new Uint8Array(data);
        const binary = Array.from(buffer).map(byte => String.fromCharCode(byte)).join('');
        localStorage.setItem('comicsDatabase', btoa(binary));
        return true;
    } catch (error) {
        console.error('Errore nel salvataggio del database:', error);
        showToast('Errore nel salvataggio dei dati', 5000);
        return false;
    }
}

// Funzione per caricare il database dal localStorage
async function loadDatabase() {
    try {
        const savedData = localStorage.getItem('comicsDatabase');
        if (savedData) {
            const binary = atob(savedData);
            const buffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                buffer[i] = binary.charCodeAt(i);
            }
            db = new SQL.Database(buffer);
        } else {
            db = new SQL.Database();
            // Creazione della tabella delle collezioni con campo immagine
            db.run(`CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY,
                collana TEXT,
                nomeFumetto TEXT,
                numeri INTEGER,
                owned TEXT,
                copertina TEXT
            )`);
        }
        loadCollectionsFromDB();
    } catch (error) {
        console.error('Errore nel caricamento del database:', error);
        // Se c'è un errore, inizializza un nuovo database
        db = new SQL.Database();
        db.run(`CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY,
            collana TEXT,
            nomeFumetto TEXT,
            numeri INTEGER,
            owned TEXT,
            copertina TEXT
        )`);
        loadCollectionsFromDB();
    }
}

// Inizializzazione dell'applicazione
initSqlJs({
    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
}).then(function(sql) {
    SQL = sql;
    loadDatabase();
}).catch(error => {
    console.error('Errore nell\'inizializzazione di SQL.js:', error);
});

// Elementi DOM
const addCollectionBtn = document.getElementById('addCollectionBtn');
const viewArchiveBtn = document.getElementById('viewArchiveBtn');
const addCollectionForm = document.getElementById('addCollectionForm');
const collectionForm = document.getElementById('collectionForm');
const closeModalBtn = document.getElementById('closeModal');
const collectionsArchive = document.getElementById('collectionsArchive');
const backupBtn = document.getElementById('backupBtn');
const restoreBtn = document.getElementById('restoreBtn');
const restoreFile = document.getElementById('restoreFile');
const imageInput = document.getElementById('copertina');
const imagePreview = document.getElementById('imagePreview');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');

// Elementi DOM aggiuntivi per la modifica
const editCollectionForm = document.getElementById('editCollectionForm');
const editForm = document.getElementById('editForm');
const closeEditModal = document.getElementById('closeEditModal');
const editImageInput = document.getElementById('editCopertina');
const editImagePreview = document.getElementById('editImagePreview');
const editUploadPlaceholder = document.getElementById('editUploadPlaceholder');

// Elementi DOM aggiuntivi
const removeImageBtn = document.getElementById('removeImage');

// Elementi DOM per la ricerca e i filtri
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const sortSelect = document.getElementById('sortSelect');
const filterSelect = document.getElementById('filterSelect');

// Elementi DOM per il tema e la vista
const themeToggleBtn = document.getElementById('themeToggleBtn');
const viewToggleBtn = document.getElementById('viewToggleBtn');

// Variabili per tenere traccia dello stato corrente
let currentCollections = [];
let searchTerm = '';
let currentSort = 'alphabetical';
let currentFilter = 'all';

// Gestione del tema
let isDarkTheme = localStorage.getItem('theme') === 'dark';
let isListView = localStorage.getItem('view') === 'list';

// Funzione per mostrare notifiche toast
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => document.body.removeChild(toast), 300);
    }, duration);
}

// Inizializzazione del tema
function initializeTheme() {
    if (isDarkTheme) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

// Inizializzazione della vista
function initializeView() {
    if (isListView) {
        collectionsArchive.classList.add('list-view');
        viewToggleBtn.innerHTML = '<i class="fas fa-grid-2"></i>';
    } else {
        collectionsArchive.classList.remove('list-view');
        viewToggleBtn.innerHTML = '<i class="fas fa-list"></i>';
    }
}

// Event listener per il toggle del tema
themeToggleBtn.addEventListener('click', () => {
    isDarkTheme = !isDarkTheme;
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    
    if (isDarkTheme) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        showToast('Tema scuro attivato');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        showToast('Tema chiaro attivato');
    }
});

// Event listener per il toggle della vista
viewToggleBtn.addEventListener('click', () => {
    isListView = !isListView;
    localStorage.setItem('view', isListView ? 'list' : 'grid');
    
    if (isListView) {
        collectionsArchive.classList.add('list-view');
        viewToggleBtn.innerHTML = '<i class="fas fa-grid-2"></i>';
        showToast('Vista a lista attivata');
    } else {
        collectionsArchive.classList.remove('list-view');
        viewToggleBtn.innerHTML = '<i class="fas fa-list"></i>';
        showToast('Vista a griglia attivata');
    }
});

// Event Listeners
addCollectionBtn.addEventListener('click', () => {
    collectionForm.reset();
    imagePreview.src = '';
    imagePreview.classList.add('hidden');
    uploadPlaceholder.style.display = 'flex';
    addCollectionForm.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    addCollectionForm.classList.add('hidden');
});

collectionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const collana = document.getElementById('collana').value.trim();
        const nomeFumetto = document.getElementById('nomeFumetto').value.trim();
        const numeri = parseInt(document.getElementById('numeri').value);
        const copertina = imagePreview.classList.contains('hidden') ? '' : imagePreview.src;

        // Validazione
        if (!collana) throw new Error('Il campo Collana è obbligatorio');
        if (!nomeFumetto) throw new Error('Il campo Nome Fumetto è obbligatorio');
        if (isNaN(numeri) || numeri < 1) throw new Error('Il numero di fumetti deve essere maggiore di 0');

        // Verifica duplicati
        const checkStmt = db.prepare('SELECT COUNT(*) as count FROM collections WHERE collana = ? AND nomeFumetto = ?');
        const result = checkStmt.getAsObject({1: collana, 2: nomeFumetto});
        if (result.count > 0) {
            throw new Error('Esiste già una collezione con questo nome');
        }

        const owned = new Array(numeri).fill(false);
        
        // Inserimento
        db.run(
            'INSERT INTO collections (collana, nomeFumetto, numeri, owned, copertina) VALUES (?, ?, ?, ?, ?)',
            [collana, nomeFumetto, numeri, JSON.stringify(owned), copertina]
        );
        
        saveDatabase();
        loadCollectionsFromDB();
        
        // Reset form
        collectionForm.reset();
        imagePreview.src = '';
        imagePreview.classList.add('hidden');
        uploadPlaceholder.style.display = 'flex';
        addCollectionForm.classList.add('hidden');
        
        showToast('Collezione aggiunta con successo!');
    } catch (error) {
        console.error('Errore durante l\'aggiunta della collezione:', error);
        showToast('Errore: ' + error.message, 5000);
    }
});

// Gestione preview immagine
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        if (!file.type.startsWith('image/')) {
            throw new Error('Il file selezionato non è un\'immagine valida');
        }

        if (file.size > 5 * 1024 * 1024) {
            throw new Error('L\'immagine è troppo grande (max 5MB)');
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.classList.remove('hidden');
            uploadPlaceholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Errore nel caricamento dell\'immagine:', error);
        showToast('Errore: ' + error.message, 5000);
        imageInput.value = '';
    }
});

viewArchiveBtn.addEventListener('click', () => {
    loadCollectionsFromDB();
});

// Funzione per aggiornare una collezione nel database
function updateCollectionInDB(collection) {
    try {
        if (!collection || !collection.id || !Array.isArray(collection.owned)) {
            throw new Error('Dati della collezione non validi');
        }
        
        db.run(
            'UPDATE collections SET owned = ? WHERE id = ?',
            [JSON.stringify(collection.owned), collection.id]
        );
        saveDatabase();
        showToast('Collezione aggiornata con successo');
    } catch (error) {
        console.error('Errore nell\'aggiornamento della collezione:', error);
        showToast('Errore nell\'aggiornamento della collezione', 5000);
    }
}

// Event listeners per la ricerca e i filtri
searchInput.addEventListener('input', debounce(() => {
    searchTerm = searchInput.value.toLowerCase();
    applyFiltersAndSort();
}, 300));

searchBtn.addEventListener('click', () => {
    searchTerm = searchInput.value.toLowerCase();
    applyFiltersAndSort();
});

sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    applyFiltersAndSort();
});

filterSelect.addEventListener('change', () => {
    currentFilter = filterSelect.value;
    applyFiltersAndSort();
});

// Funzione di debounce per ottimizzare la ricerca
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Funzione per applicare filtri e ordinamento
function applyFiltersAndSort() {
    let filteredCollections = [...currentCollections];

    // Applica la ricerca
    if (searchTerm) {
        filteredCollections = filteredCollections.filter(collection => 
            collection.collana.toLowerCase().includes(searchTerm) ||
            collection.nomeFumetto.toLowerCase().includes(searchTerm)
        );
    }

    // Applica il filtro
    switch (currentFilter) {
        case 'complete':
            filteredCollections = filteredCollections.filter(collection => {
                const stats = calculateCollectionStats(collection.owned);
                return stats.percentage === 100;
            });
            break;
        case 'incomplete':
            filteredCollections = filteredCollections.filter(collection => {
                const stats = calculateCollectionStats(collection.owned);
                return stats.percentage < 100;
            });
            break;
    }

    // Applica l'ordinamento
    switch (currentSort) {
        case 'alphabetical':
            filteredCollections.sort((a, b) => 
                a.collana.localeCompare(b.collana) || 
                a.nomeFumetto.localeCompare(b.nomeFumetto)
            );
            break;
        case 'completion':
            filteredCollections.sort((a, b) => {
                const statsA = calculateCollectionStats(a.owned);
                const statsB = calculateCollectionStats(b.owned);
                return statsB.percentage - statsA.percentage;
            });
            break;
        case 'recent':
            // Assumiamo che l'ordine nell'array sia già per data di aggiunta
            // In futuro potremmo aggiungere un timestamp alla collezione
            break;
    }

    renderCollections(filteredCollections);
}

// Funzioni di utilità
function loadCollectionsFromDB() {
    currentCollections = [];
    try {
        const results = db.exec('SELECT * FROM collections');
        if (results && results.length > 0) {
            const rows = results[0].values;
            rows.forEach(row => {
                try {
                    const owned = JSON.parse(row[4]);
                    if (!Array.isArray(owned)) {
                        throw new Error('Il campo owned non è un array valido');
                    }
                    currentCollections.push({
                        id: row[0],
                        collana: row[1] || '',
                        nomeFumetto: row[2] || '',
                        numeri: parseInt(row[3]) || 0,
                        owned: owned,
                        copertina: row[5] || ''
                    });
                } catch (parseError) {
                    console.error('Errore nel parsing dei dati della collezione:', parseError);
                }
            });
        }
        applyFiltersAndSort();
    } catch (error) {
        console.error('Errore nel caricamento delle collezioni:', error);
        showToast('Errore nel caricamento delle collezioni', 5000);
    }
}

function calculateCollectionStats(owned) {
    const total = owned.length;
    const ownedCount = owned.filter(status => status).length;
    return {
        total,
        owned: ownedCount,
        missing: total - ownedCount,
        percentage: Math.round((ownedCount / total) * 100)
    };
}

function formatDate(date) {
    return date.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function printCollection(collection, stats) {
    const printSection = document.createElement('div');
    printSection.className = 'print-section';
    
    // Aggiungi l'intestazione
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `
        <h1>Collezione Fumetti</h1>
        <h2>${collection.collana}</h2>
    `;
    printSection.appendChild(header);
    
    // Aggiungi l'immagine di copertina se presente
    if (collection.copertina) {
        const coverImage = document.createElement('img');
        coverImage.src = collection.copertina;
        coverImage.className = 'collection-cover';
        coverImage.alt = `Copertina ${collection.nomeFumetto}`;
        printSection.appendChild(coverImage);
    }
    
    // Aggiungi le informazioni della collezione
    const info = document.createElement('div');
    info.className = 'collection-info';
    info.innerHTML = `
        <h3>${collection.nomeFumetto}</h3>
        <div class="collection-status">
            <p>Numeri totali: ${collection.numeri}</p>
            <p>Numeri posseduti: ${stats.owned}</p>
            <p>Numeri mancanti: ${stats.missing}</p>
            <p>Completamento: ${stats.percentage}%</p>
        </div>
    `;
    printSection.appendChild(info);
    
    // Aggiungi la griglia dei numeri
    const grid = document.createElement('div');
    grid.className = 'numbers-grid';
    
    for (let i = 0; i < collection.numeri; i++) {
        const numberCircle = document.createElement('div');
        numberCircle.className = `number-circle ${collection.owned[i] ? 'owned' : 'missing'}`;
        numberCircle.textContent = i + 1;
        grid.appendChild(numberCircle);
    }
    printSection.appendChild(grid);
    
    // Aggiungi la data di stampa
    const dateInfo = document.createElement('div');
    dateInfo.className = 'print-date';
    dateInfo.textContent = `Stampato il ${formatDate(new Date())}`;
    printSection.appendChild(dateInfo);
    
    // Aggiungi la sezione al documento
    document.body.appendChild(printSection);
    
    // Stampa e poi rimuovi la sezione
    window.print();
    
    // Rimuovi la sezione dopo un breve delay per assicurarsi che la stampa sia completata
    setTimeout(() => {
        document.body.removeChild(printSection);
    }, 1000);
}

// Aggiungi animazioni alle card
function addCardAnimations() {
    const cards = document.querySelectorAll('.collection-card');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
}

// Funzione per aprire il form di modifica
function openEditForm(collection) {
    // Previeni la propagazione dell'evento click
    event.stopPropagation();
    
    // Imposta i valori dei campi
    document.getElementById('editCollectionId').value = collection.id;
    document.getElementById('editCollana').value = collection.collana;
    document.getElementById('editNomeFumetto').value = collection.nomeFumetto;
    document.getElementById('editNumeri').value = collection.numeri;
    
    // Gestione immagine
    if (collection.copertina) {
        editImagePreview.src = collection.copertina;
        editImagePreview.classList.remove('hidden');
    } else {
        editImagePreview.src = '';
        editImagePreview.classList.add('hidden');
    }
    
    editCollectionForm.classList.remove('hidden');
}

// Gestione del form di modifica
editForm.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!validateEditForm()) {
        return;
    }
    
    const id = document.getElementById('editCollectionId').value;
    const collana = document.getElementById('editCollana').value.trim();
    const nomeFumetto = document.getElementById('editNomeFumetto').value.trim();
    const numeriNuovi = parseInt(document.getElementById('editNumeri').value);
    const copertina = editImagePreview.classList.contains('hidden') ? '' : editImagePreview.src;
    
    try {
        // Recupera la collezione corrente per mantenere lo stato dei numeri posseduti
        const stmt = db.prepare('SELECT owned FROM collections WHERE id = ?');
        const result = stmt.getAsObject([id]);
        
        if (!result) {
            throw new Error('Collezione non trovata');
        }
        
        let owned = JSON.parse(result.owned);
        
        // Gestisci il cambio del numero totale di fumetti
        if (numeriNuovi !== owned.length) {
            if (numeriNuovi > owned.length) {
                // Aggiungi nuovi numeri come non posseduti
                owned = [...owned, ...new Array(numeriNuovi - owned.length).fill(false)];
            } else {
                // Chiedi conferma prima di rimuovere i numeri
                if (numeriNuovi < owned.length && !confirm('Ridurre il numero di fumetti rimuoverà lo stato dei numeri eliminati. Continuare?')) {
                    return;
                }
                // Rimuovi i numeri in eccesso
                owned = owned.slice(0, numeriNuovi);
            }
        }
        
        // Aggiorna il database
        db.run(
            'UPDATE collections SET collana = ?, nomeFumetto = ?, numeri = ?, owned = ?, copertina = ? WHERE id = ?',
            [collana, nomeFumetto, numeriNuovi, JSON.stringify(owned), copertina, id]
        );
        
        saveDatabase();
        loadCollectionsFromDB();
        
        // Chiudi il form e mostra il messaggio di successo
        editCollectionForm.classList.add('hidden');
        editForm.reset();
        
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'Collezione aggiornata con successo!';
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
            document.body.removeChild(successMessage);
        }, 3000);
        
    } catch (error) {
        console.error('Errore durante l\'aggiornamento:', error);
        alert('Si è verificato un errore durante l\'aggiornamento della collezione: ' + error.message);
    }
});

// Gestione del click sul form per prevenire la chiusura
editCollectionForm.querySelector('.modal-content').addEventListener('click', function(e) {
    e.stopPropagation();
});

// Chiusura del form quando si clicca fuori
editCollectionForm.addEventListener('click', function(e) {
    if (e.target === this) {
        editCollectionForm.classList.add('hidden');
        editForm.reset();
    }
});

// Gestione del pulsante di chiusura
closeEditModal.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    editCollectionForm.classList.add('hidden');
    editForm.reset();
});

// Validazione del form di modifica
function validateEditForm() {
    const collana = document.getElementById('editCollana').value.trim();
    const nomeFumetto = document.getElementById('editNomeFumetto').value.trim();
    const numeri = parseInt(document.getElementById('editNumeri').value);
    
    if (!collana) {
        alert('Il campo Collana è obbligatorio.');
        return false;
    }
    if (!nomeFumetto) {
        alert('Il campo Nome Fumetto è obbligatorio.');
        return false;
    }
    if (isNaN(numeri) || numeri < 1) {
        alert('Il numero di fumetti deve essere maggiore di 0.');
        return false;
    }
    return true;
}

// Funzione per creare il backup in formato JSON
function createBackupData() {
    try {
        const results = db.exec('SELECT * FROM collections');
        const collections = [];
        
        if (results && results.length > 0) {
            results[0].values.forEach(row => {
                collections.push({
                    id: row[0],
                    collana: row[1] || '',
                    nomeFumetto: row[2] || '',
                    numeri: parseInt(row[3]) || 0,
                    owned: JSON.parse(row[4]),
                    copertina: row[5] || ''
                });
            });
        }

        return {
            version: '1.0',
            timestamp: new Date().toISOString(),
            collections: collections
        };
    } catch (error) {
        console.error('Errore nella creazione del backup:', error);
        throw new Error('Impossibile creare il backup dei dati');
    }
}

// Modifica della gestione del backup
backupBtn.addEventListener('click', () => {
    try {
        const backupData = createBackupData();
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `fumetti_backup_${date}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup creato con successo');
    } catch (error) {
        console.error('Errore durante il backup:', error);
        showToast('Errore durante la creazione del backup: ' + error.message, 5000);
    }
});

// Funzione per validare il file di backup
function validateBackupData(data) {
    // Verifica la versione del backup
    if (!data.version || data.version !== '1.0') {
        throw new Error('Versione del backup non supportata');
    }

    // Verifica la presenza delle collezioni
    if (!Array.isArray(data.collections)) {
        throw new Error('Formato del backup non valido');
    }

    // Verifica che ci siano collezioni
    if (data.collections.length === 0) {
        throw new Error('Il backup non contiene collezioni');
    }

    // Verifica la struttura di ogni collezione
    data.collections.forEach((collection, index) => {
        const requiredFields = ['collana', 'nomeFumetto', 'numeri', 'owned'];
        requiredFields.forEach(field => {
            if (!(field in collection)) {
                throw new Error(`Campo mancante '${field}' nella collezione ${index + 1}`);
            }
        });

        // Verifica il formato dei dati
        if (!Array.isArray(collection.owned)) {
            throw new Error(`Campo 'owned' non valido nella collezione ${index + 1}`);
        }
        if (typeof collection.numeri !== 'number' || collection.numeri < 1) {
            throw new Error(`Campo 'numeri' non valido nella collezione ${index + 1}`);
        }
    });

    return true;
}

// Correzione della gestione del ripristino
restoreBtn.addEventListener('click', () => {
    restoreFile.value = ''; // Reset del valore per permettere la selezione dello stesso file
    restoreFile.click();
});

restoreFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
        showToast('Nessun file selezionato', 3000);
        return;
    }

    try {
        // Verifica del tipo di file
        if (!file.name.toLowerCase().endsWith('.json')) {
            throw new Error('Il file deve essere un backup JSON (.json)');
        }

        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                // Valida i dati del backup
                validateBackupData(jsonData);

                if (confirm(`Sei sicuro di voler ripristinare il backup? Contiene ${jsonData.collections.length} collezioni. I dati attuali verranno sovrascritti.`)) {
                    // Ricrea il database
                    db = new SQL.Database();
                    db.run(`CREATE TABLE IF NOT EXISTS collections (
                        id INTEGER PRIMARY KEY,
                        collana TEXT,
                        nomeFumetto TEXT,
                        numeri INTEGER,
                        owned TEXT,
                        copertina TEXT
                    )`);

                    // Inserisci le collezioni
                    jsonData.collections.forEach(collection => {
                        db.run(
                            'INSERT INTO collections (collana, nomeFumetto, numeri, owned, copertina) VALUES (?, ?, ?, ?, ?)',
                            [
                                collection.collana,
                                collection.nomeFumetto,
                                collection.numeri,
                                JSON.stringify(collection.owned),
                                collection.copertina || ''
                            ]
                        );
                    });

                    saveDatabase();
                    loadCollectionsFromDB();
                    showToast(`Backup ripristinato con successo! Ripristinate ${jsonData.collections.length} collezioni.`);
                } else {
                    showToast('Ripristino annullato');
                }
            } catch (error) {
                console.error('Errore durante il ripristino:', error);
                showToast('Errore durante il ripristino: ' + error.message, 5000);
            }
        };

        reader.onerror = function() {
            showToast('Errore nella lettura del file', 5000);
        };

        reader.readAsText(file);

    } catch (error) {
        console.error('Errore durante il ripristino:', error);
        showToast('Errore durante il ripristino: ' + error.message, 5000);
    }
});

// Funzione helper per verificare la validità del database
function isValidDatabase(db) {
    try {
        // Verifica che il database abbia la struttura corretta
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        if (!tables || !tables.length) return false;

        // Verifica che esista la tabella collections
        const hasCollectionsTable = tables[0].values.some(([name]) => name === 'collections');
        if (!hasCollectionsTable) return false;

        // Verifica la struttura della tabella collections
        const columns = db.exec("PRAGMA table_info(collections)");
        const requiredColumns = ['id', 'collana', 'nomeFumetto', 'numeri', 'owned', 'copertina'];
        const hasAllColumns = requiredColumns.every(col => 
            columns[0].values.some(([_, name]) => name === col)
        );
        if (!hasAllColumns) return false;

        return true;
    } catch (error) {
        console.error('Errore nella validazione del database:', error);
        return false;
    }
}

// Carica le collezioni all'avvio
renderCollections();

// Inizializza tema e vista all'avvio
document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeTheme();
        initializeView();
        
        // Verifica che tutti gli elementi DOM necessari siano presenti
        const requiredElements = {
            addCollectionBtn,
            viewArchiveBtn,
            addCollectionForm,
            collectionForm,
            closeModalBtn,
            collectionsArchive,
            backupBtn,
            restoreBtn,
            restoreFile,
            themeToggleBtn,
            viewToggleBtn
        };

        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                throw new Error(`Elemento DOM mancante: ${name}`);
            }
        }

    } catch (error) {
        console.error('Errore durante l\'inizializzazione:', error);
        showToast('Errore durante l\'inizializzazione dell\'applicazione', 5000);
    }
}); 