import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// --- PERCORSO DEL DATABASE ---
const DB_FILE = path.join(__dirname, 'database.json');

// --- DATI INIZIALI ---
const pizzerie = ['Antica Pizzeria', 'Pizza della cava', 'Free_Pizza'];

// Struttura dati in memoria
let dati = {
  utenti: [
    { id: 1, username: 'boss', password: '123', role: 'boss', nome: 'Capo', orario: 'Sempre' }
  ],
  assenze: [] as any[],
  turni: [] as any[]
};

// --- FUNZIONI DATABASE ---

// 1. Carica i dati
function caricaDati() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const rawData = fs.readFileSync(DB_FILE, 'utf-8');
      dati = JSON.parse(rawData);
      console.log("📂 Database caricato.");
    } catch (err) {
      console.log("⚠️ Errore lettura DB, resetto.");
      salvaDati();
    }
  } else {
    console.log("🆕 Creo nuovo database.");
    salvaDati();
  }
}

// 2. Salva i dati
function salvaDati() {
  fs.writeFileSync(DB_FILE, JSON.stringify(dati, null, 2));
}

caricaDati();

// --- API ---

// LOGIN
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = dati.utenti.find((u: any) => u.username === username && u.password === password);
  if (user) res.json(user);
  else res.status(401).json({ error: 'Credenziali errate' });
});

// REGISTRAZIONE (Imposta SEMPRE role = 'nuovo')
app.post('/register', (req, res) => {
  const { nome, username, password } = req.body;

  if (dati.utenti.find((u: any) => u.username === username)) {
    return res.status(400).json({ error: 'Username già usato!' });
  }

  const newUser = {
    id: Date.now(),
    nome,
    username,
    password,
    role: 'nuovo', // <--- FONDAMENTALE: Forza il setup al primo avvio
    orario: ''     // <--- Vuoto per ora
  };

  dati.utenti.push(newUser);
  salvaDati();
  res.json(newUser);
});

// SETUP PRIMO ACCESSO (Salva ruolo e ORARIO FATTORINO)
app.post('/complete-setup', (req, res) => {
  const { userId, role, orario } = req.body;
  
  // Trova l'utente nell'array
  const userIndex = dati.utenti.findIndex((u: any) => u.id === userId);
  
  if (userIndex !== -1) {
    // Aggiorna i dati dell'utente
    dati.utenti[userIndex].role = role;
    
    // Se è fattorino, salva l'orario scelto (es. "19:00 - 21:30")
    if (role === 'fattorino') {
      dati.utenti[userIndex].orario = orario;
    } else {
      dati.utenti[userIndex].orario = 'Turno Pizzaiolo/Cassiere';
    }

    salvaDati(); // Scrivi su file
    
    console.log(`Setup completato per ${dati.utenti[userIndex].nome}: ${role}, ${orario}`);
    res.json({ success: true, user: dati.utenti[userIndex] });
  } else {
    res.status(404).json({ error: 'Utente non trovato' });
  }
});

// GESTIONE ASSENZE
app.post('/update-assenze', (req, res) => {
  const { userId, giorni } = req.body;
  dati.assenze = dati.assenze.filter((a: any) => a.userId !== userId);
  giorni.forEach((g: string) => {
    dati.assenze.push({ userId, day: g });
  });
  salvaDati();
  res.json({ message: 'Ok' });
});

// GESTIONE TURNI BOSS
app.post('/turni', (req, res) => {
  dati.turni = req.body;
  salvaDati();
  res.json({ message: 'Ok' });
});

// LICENZIAMENTO
app.post('/delete-user', (req, res) => {
  const { userId } = req.body;
  dati.utenti = dati.utenti.filter((u: any) => u.id !== userId);
  dati.assenze = dati.assenze.filter((a: any) => a.userId !== userId);
  dati.turni = dati.turni.filter((t: any) => t.userId !== userId);
  salvaDati();
  res.json({ success: true });
});

// DATI GENERALI
app.get('/data', (req, res) => {
  res.json({ 
    utenti: dati.utenti, 
    pizzerie, 
    assenze: dati.assenze, 
    turni: dati.turni 
  });
});

app.listen(port, () => {
  console.log(`✅ Server attivo su http://127.0.0.1:${port}`);
});