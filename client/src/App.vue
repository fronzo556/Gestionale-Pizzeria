<script setup lang="ts">
import { ref, computed } from 'vue'

// --- STATO UTENTE ---
const user = ref<any>(null)
const isRegistering = ref(false)

// Form Dati
const username = ref('')
const password = ref('')
const regNome = ref('')
const regUser = ref('')
const regPass = ref('')
const setupRole = ref('') 
const setupOrario = ref('') 


const bossView = ref('calendar')

// --- STATO CALENDARIO ---
const currentDate = ref(new Date()) 
const realToday = new Date() 

const nomeMese = computed(() => {
  return currentDate.value.toLocaleString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()
})

const giorniNelMese = computed(() => {
  return new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 0).getDate()
})

function getNomeGiorno(giorno: number) {
  const d = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), giorno)
  const nome = d.toLocaleDateString('it-IT', { weekday: 'short' })
  return nome.charAt(0).toUpperCase() + nome.slice(1) 
}

//  LOGICA DI BLOCCO TEMPORALE 
const isLockedForEmployee = computed(() => {
  if (!user.value || user.value.role === 'boss') return false 

  const targetYear = currentDate.value.getFullYear()
  const targetMonth = currentDate.value.getMonth()
  const realYear = realToday.getFullYear()
  const realMonth = realToday.getMonth()

  if (targetYear < realYear || (targetYear === realYear && targetMonth <= realMonth)) return true 

  const isNextMonth = (targetYear === realYear && targetMonth === realMonth + 1) || 
                      (targetYear === realYear + 1 && targetMonth === 0 && realMonth === 11)

  if (isNextMonth) {
    const giorniMeseReale = new Date(realYear, realMonth + 1, 0).getDate()
    const giornoLimite = giorniMeseReale - 3 
    if (realToday.getDate() >= giornoLimite) return true 
  }
  return false 
})

function mesePrecedente() {
  currentDate.value.setMonth(currentDate.value.getMonth() - 1)
  currentDate.value = new Date(currentDate.value)
  giornoSelezionatoBoss.value = null
}
function meseSuccessivo() {
  currentDate.value.setMonth(currentDate.value.getMonth() + 1)
  currentDate.value = new Date(currentDate.value)
  giornoSelezionatoBoss.value = null
}

function getDataKey(giorno: number) {
  const anno = currentDate.value.getFullYear()
  const mese = (currentDate.value.getMonth() + 1).toString().padStart(2, '0')
  const gg = giorno.toString().padStart(2, '0')
  return `${anno}-${mese}-${gg}`
}

// Dati e Stato
const utentiDB = ref<any[]>([])
const assenzeDB = ref<any[]>([]) 
const turniDB = ref<any[]>([])
const pizzerieNomi = ref<string[]>([])
const giornoSelezionatoBoss = ref<number | null>(null)
const assenzeLocali = ref<string[]>([])
const modificheNonSalvate = ref(false)

//  API 
async function login() {
  if (!username.value || !password.value) return alert("Inserisci username e password!")
  try {
    const res = await fetch('http://127.0.0.1:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    if (res.ok) {
      user.value = await res.json()
      if (user.value.role !== 'nuovo') {
        await loadData()
        if (user.value.role !== 'boss') syncLocaliConDB()
      }
    } else alert("Credenziali errate!")
  } catch(e) { alert("Errore connessione server.") }
}

async function register() {
  if (!regNome.value || !regUser.value || !regPass.value) return alert("Compila tutto!")
  const res = await fetch('http://127.0.0.1:3000/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: regNome.value, username: regUser.value, password: regPass.value })
  })
  if (res.ok) { alert("Registrato!"); isRegistering.value = false }
}

async function completaSetup() {
  if (!setupRole.value) return alert("Scegli un ruolo!")
  if (setupRole.value === 'fattorino' && !setupOrario.value) return alert("Scegli un orario!")
  const res = await fetch('http://127.0.0.1:3000/complete-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.value.id, role: setupRole.value, orario: setupOrario.value })
  })
  if (res.ok) {
    const data = await res.json()
    user.value = data.user 
    await loadData()
    syncLocaliConDB()
  }
}

function logout() { user.value = null; username.value = ''; password.value = ''; giornoSelezionatoBoss.value = null; bossView.value = 'calendar'; }

async function loadData() {
  const res = await fetch('http://127.0.0.1:3000/data')
  const data = await res.json()
  utentiDB.value = data.utenti
  pizzerieNomi.value = data.pizzerie
  assenzeDB.value = data.assenze
  turniDB.value = data.turni
}

function syncLocaliConDB() {
  assenzeLocali.value = assenzeDB.value.filter(a => a.userId === user.value.id).map(a => a.day)
  modificheNonSalvate.value = false
}

function toggleGiornoLocale(giorno: number) {
  if (user.value.role === 'boss') { giornoSelezionatoBoss.value = giorno; return; }
  if (isLockedForEmployee.value) return;

  const dateKey = getDataKey(giorno)
  const index = assenzeLocali.value.indexOf(dateKey)
  if (index >= 0) assenzeLocali.value.splice(index, 1) 
  else assenzeLocali.value.push(dateKey) 
  modificheNonSalvate.value = true
}

async function salvaDisponibilita() {
  await fetch('http://127.0.0.1:3000/update-assenze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.value.id, giorni: assenzeLocali.value })
  })
  await loadData()
  modificheNonSalvate.value = false
  alert("✅ Disponibilità salvata!")
}

// FUNZIONI CONTROLLO VISIVO CALENDARIO
function isRosso(giorno: number) {
  if (user.value.role === 'boss') return false 
  return assenzeLocali.value.includes(getDataKey(giorno))
}

function lavoroOggi(giorno: number) {
  const dateKey = getDataKey(giorno)
  const turno = turniDB.value.find(t => t.day === dateKey && t.userId === user.value.id)
  return turno ? pizzerieNomi.value[turno.pizzeriaIndex] : null
}

function isGiornoGestitoBoss(giorno: number) {
  const dateKey = getDataKey(giorno)
  return turniDB.value.some(t => t.day === dateKey)
}

// FUNZIONI BOSS 
function getStaffDisponibile(role: string) {
  const dateKey = getDataKey(giornoSelezionatoBoss.value!)
  return utentiDB.value.filter(u => u.role === role && !assenzeDB.value.some(a => a.userId === u.id && a.day === dateKey))
}

function isAssegnato(userId: number, pizzeriaIdx: number) {
  const dateKey = getDataKey(giornoSelezionatoBoss.value!)
  return turniDB.value.some(t => t.day === dateKey && t.userId === userId && t.pizzeriaIndex === pizzeriaIdx)
}

function toggleAssegnazione(userId: number, pizzeriaIdx: number) {
  const dateKey = getDataKey(giornoSelezionatoBoss.value!)
  const esisteIndex = turniDB.value.findIndex(t => t.day === dateKey && t.userId === userId)
  if (esisteIndex >= 0) turniDB.value.splice(esisteIndex, 1)
  turniDB.value.push({ day: dateKey, userId, pizzeriaIndex: pizzeriaIdx })
}

async function salvaTurniBoss() {
  await fetch('http://127.0.0.1:3000/turni', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(turniDB.value)
  })
  alert("Turni salvati!")
  giornoSelezionatoBoss.value = null
  await loadData() 
}

//  FUNZIONE LICENZIAMENTO 
async function licenziaUtente(userId: number, nomeUtente: string) {
  if (confirm(`⚠️ ATTENZIONE: Vuoi licenziare e rimuovere per sempre "${nomeUtente}"?`)) {
    await fetch('http://127.0.0.1:3000/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })
    alert(`Utente ${nomeUtente} rimosso con successo.`)
    await loadData() // Aggiorna la lista
  }
}
</script>

<template>
  <div class="app">
    <h1 class="main-title">📅 Gestionale Pizzeria</h1>

    <div v-if="!user" class="auth-container">
      <div v-if="!isRegistering" class="card pomodoro-card">
        <h2>FREE_PIZZA</h2>
        <input v-model="username" placeholder="Username" @keyup.enter="login" />
        <input v-model="password" type="password" placeholder="Password" @keyup.enter="login" />
        <button @click="login" class="big-btn basilico-btn">ACCEDI</button>
        <p class="link" @click="isRegistering = true">Non hai un account? <b>Registrati qui</b></p>
      </div>
      <div v-else class="card pomodoro-card">
        <h2>Nuovo Dipendente</h2>
        <input v-model="regNome" placeholder="Il tuo Nome" />
        <input v-model="regUser" placeholder="Scegli Username" />
        <input v-model="regPass" type="password" placeholder="Scegli Password" />
        <button @click="register" class="big-btn basilico-btn">CREA ACCOUNT</button>
        <p class="link" @click="isRegistering = false">Torna al Login</p>
      </div>
    </div>

    <div v-else-if="user.role === 'nuovo'" class="card pomodoro-card setup-box">
      <h2>Benvenuto, {{ user.nome }}! 👋</h2>
      <p>Seleziona il tuo ruolo:</p>
      <div class="role-selector">
        <label><input type="radio" value="pizzaiolo/cassiere" v-model="setupRole"> 👨‍🍳 Pizzaiolo/💶Cassiere</label>
        <label><input type="radio" value="fattorino/cassiere" v-model="setupRole"> 🛵 Fattorino/💶Cassiere</label>
      </div>
      <div v-if="setupRole === 'fattorino/cassiere'">
        <select v-model="setupOrario">
          <option disabled value="">Scegli orario...</option>
          <option>17:00 - 22:30</option>
          <option>19:00 - 21:30</option>
        </select>
      </div>
      <button @click="completaSetup" class="big-btn basilico-btn">INIZIA</button>
    </div>

    <div v-else>
      <div class="header-bar crust-bar">
        <div>Ciao, <b>{{ user.nome }}</b> <span class="badge">{{ user.role }}</span></div>
        <button class="logout-btn" @click="logout">Esci 🚪</button>
      </div>

      <div class="main-interface">
        
        <div class="toolbar crust-bar">
          
          <div v-if="user.role === 'boss'" class="boss-nav">
             <button class="nav-btn-boss" :class="{ 'active-tab': bossView === 'calendar'}" @click="bossView = 'calendar'">📅 CALENDARIO</button>
             <button class="nav-btn-boss" :class="{ 'active-tab': bossView === 'staff'}" @click="bossView = 'staff'">👥 GESTIONE STAFF</button>
          </div>

          <div v-if="user.role !== 'boss' || bossView === 'calendar'" class="month-nav">
            <button class="nav-btn" @click="mesePrecedente">⬅️</button>
            <h2 class="month-title">{{ nomeMese }}</h2>
            <button class="nav-btn" @click="meseSuccessivo">➡️</button>
          </div>

          <div class="toolbar-content">
            <div v-if="user.role !== 'boss'">
              <p v-if="isLockedForEmployee" class="lock-msg">⛔ MODIFICHE BLOCCATE</p>
              <p v-else>Clicca i giorni in cui sei <b>ASSENTE</b>.</p>
              
              <div v-if="!isLockedForEmployee">
                <button v-if="modificheNonSalvate" class="save-btn blink" @click="salvaDisponibilita">💾 SALVA</button>
                <button v-else class="save-btn disabled" disabled>✅ Salvato</button>
              </div>
            </div>
            
            <p v-else-if="bossView === 'calendar'">👑 Area Boss: Clicca sul giorno per i turni.</p>
            <p v-else>👑 Area Boss: Qui puoi gestire e licenziare il personale.</p>
          </div>
        </div>

        <div v-if="user.role !== 'boss' || bossView === 'calendar'" class="calendar-grid">
          <div v-for="g in giorniNelMese" :key="g" 
               class="day-box"
               :class="{ 
                 'red': isRosso(g), 
                 'green': user.role !== 'boss' && lavoroOggi(g),
                 'boss-managed': user.role === 'boss' && isGiornoGestitoBoss(g),
                 'locked': user.role !== 'boss' && isLockedForEmployee 
               }"
               @click="toggleGiornoLocale(g)">
            
            <div class="day-header">
              <span class="day-name">{{ getNomeGiorno(g) }}</span>
              <span class="day-num">{{ g }}</span>
            </div>
            
            <div v-if="user.role !== 'boss'">
               <span v-if="isRosso(g)" class="status-no">❌ NO</span>
               <span v-else-if="lavoroOggi(g)" class="status-work">🍕 {{ lavoroOggi(g) }}</span>
            </div>
            <div v-else>
               <small class="status-boss" v-if="isGiornoGestitoBoss(g)">✅ GESTITO</small>
               <small class="status-boss" v-else>➕ GESTISCI</small>
            </div>
          </div>
        </div>

        <div v-if="user.role === 'boss' && bossView === 'staff'" class="staff-view-container">
          <div class="staff-grid">
             <div v-for="u in utentiDB" :key="u.id" class="staff-card-box" v-show="u.role !== 'boss'">
                <div class="staff-info">
                  <h3>{{ u.nome }}</h3>
                  <p>👤 Username: <b>{{ u.username }}</b></p>
                  <p>🏷️ Ruolo: <b>{{ u.role }}</b></p>
                  <p v-if="u.role === 'fattorino'">⏰ Orario: <b>{{ u.orario }}</b></p>
                </div>
                <button class="trash-btn-big" @click="licenziaUtente(u.id, u.nome)">🗑️ LICENZIA</button>
             </div>
             <p v-if="utentiDB.length <= 1">Nessun dipendente registrato.</p>
          </div>
        </div>

      </div>

      <div v-if="giornoSelezionatoBoss" class="modal-overlay">
        <div class="modal card">
          <h2>Giorno {{ getNomeGiorno(giornoSelezionatoBoss) }} {{ giornoSelezionatoBoss }} {{ nomeMese }}</h2>
          <div class="pizzerie-container">
            <div v-for="(piz, idx) in pizzerieNomi" :key="idx" class="pizzeria-col">
              <h3>{{ piz }}</h3>
              
              <div class="role-group">
                <h4>👨‍🍳 Pizzaioli/💶Cassiere</h4>
                <div v-for="u in getStaffDisponibile('pizzaiolo/cassiere')" :key="u.id" class="staff-row">
                  <button :class="{ active: isAssegnato(u.id, idx) }" @click="toggleAssegnazione(u.id, idx)">{{ u.nome }}</button>
                </div>
              </div>

              <div class="role-group">
                <h4>🛵 Fattorini</h4>
                <div v-for="u in getStaffDisponibile('fattorino')" :key="u.id" class="staff-row">
                  <button :class="{ active: isAssegnato(u.id, idx) }" @click="toggleAssegnazione(u.id, idx)">{{ u.nome }}</button>
                </div>
              </div>

            </div>
          </div>
          <div class="boss-actions">
            <button class="cancel-btn" @click="giornoSelezionatoBoss = null">Annulla</button>
            <button class="save-boss-btn" @click="salvaTurniBoss">💾 SALVA E CHIUDI</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

.app { font-family: sans-serif; max-width: 900px; margin: 0 auto; text-align: center; color: #000000; padding-bottom: 50px; }
.main-title { color: #7e1414; margin-top: 30px; font-weight: bold; }
/* LOGIN E SETUP  */
.pomodoro-card { 
  background-color: #7e1414 !important; 
  padding: 30px; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.4);
  max-width: 500px; width: 90%; margin: 10px; color: #000000 !important; border: none;
}
.pomodoro-card h2, .pomodoro-card p { color: #000000 !important; font-weight: bold; }

input, select { 
  display: block; margin: 15px auto; padding: 12px; width: 85%; font-size: 1rem;
  background-color: #ffffff !important; color: #000000 !important; border: 1px solid #999; border-radius: 5px; font-weight: bold;
}
.big-btn.basilico-btn { background-color: #18703d !important; color: #000000 !important; font-size: 1.3rem; padding: 15px; width: 100%; margin-top: 20px; font-weight: bold; cursor: pointer; border: none; border-radius: 5px;}
.link { color: #000000 !important; text-decoration: underline; cursor: pointer; margin-top: 20px; display: block; font-weight: bold;}


.crust-bar { background-color: #e29c5a !important; color: #000000 !important; font-weight: bold; }
.header-bar { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
.badge { background: #7e1414; color: #ffffff; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; margin-left: 5px; }
.logout-btn { background: #333; color: #ffffff; padding: 8px 15px; border: none; cursor: pointer; border-radius: 5px; font-weight: bold;}

.toolbar { padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);}
.month-nav { display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 10px; border-bottom: 2px solid rgba(0,0,0,0.2); padding-bottom: 10px;}
.month-title { margin: 0; font-size: 1.5rem; color: #000000; }
.nav-btn { background: rgba(0,0,0,0.1); color: #000000; font-size: 1.2rem; padding: 5px 15px; border: none; border-radius: 5px; cursor: pointer;}
.toolbar-content { display: flex; justify-content: space-between; align-items: center; }
.lock-msg { color: #000000; font-weight: bold; background: rgba(255,255,255,0.7); padding: 5px; border-radius: 5px;}

/* STILE MENU BOSS */
.boss-nav { display: flex; gap: 10px; justify-content: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 5px;}
.nav-btn-boss { padding: 10px 20px; font-weight: bold; cursor: pointer; border: none; background: transparent; font-size: 1rem; color: #000;}
.nav-btn-boss.active-tab { border-bottom: 4px solid #7e1414; color: #7e1414;}

/* VISIONE STAFF */
.staff-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; margin-top: 15px;}
.staff-card-box { background: #fff; border: 2px solid #e29c5a; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between; text-align: left; box-shadow: 0 4px 6px rgba(0,0,0,0.1);}
.staff-info h3 { margin: 0 0 10px 0; color: #7e1414; border-bottom: 1px solid #ccc; padding-bottom: 5px;}
.staff-info p { margin: 5px 0; font-size: 0.9rem; color: #000;}

/* TASTO LICENZIA */
.trash-btn-big { margin-top: 15px; background: #7e1414; color: white; border: none; padding: 10px; width: 100%; border-radius: 5px; font-weight: bold; cursor: pointer;}
.trash-btn-big:hover { background: #990000; }

/* CALENDARIO */
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
.day-box { 
  border: 1px solid #7e1414; height: 85px; cursor: pointer; border-radius: 8px; 
  display: flex; flex-direction: column; justify-content: space-between; align-items: center; padding: 8px;
  background-color: #7e1414!important; color: #000000 !important; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: transform 0.1s;
}
.day-box.locked { cursor: not-allowed; opacity: 0.5; }
.day-box.red { background: #d4cdcd !important; } 
.day-box.green { background: #27ae60 !important; } 
.day-box.boss-managed { background: #27ae60 !important; }

.day-header { display: flex; justify-content: space-between; width: 100%; font-weight: bold; }
.day-name { font-size: 0.85rem; }
.day-num { font-size: 1.2rem; }
.status-no { font-weight: bold; font-size: 1.1rem; }
.status-work { font-weight: bold; font-size: 0.9rem; }
.status-boss { font-weight: bold; font-size: 0.95rem; }

/* MODALE BOSS */
.modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index: 99;}
.modal { background: #ffffff !important; width: 95%; max-width: 1000px; height: 90%; overflow-y: auto; padding: 20px; border-radius: 12px; color: #000000 !important;}
.modal h2, .modal h3, .modal h4 { color: #000000 !important; font-weight: bold;}
.pizzeria-col h3 { border-bottom: 2px solid #000000; padding-bottom: 5px; margin-bottom: 15px; }
.pizzerie-container { display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;}
.pizzeria-col { flex: 1; min-width: 250px; border: 1px solid #ccc; padding: 15px; background: #fffcfc; border-radius: 8px;}

/* Bottoni Staff  */
.staff-row { display: flex; align-items: center; justify-content: center; gap: 5px; margin: 3px 0; }
.role-group button { background: #eee; color: #000000; padding: 8px 12px; border: 1px solid #ccc; border-radius: 5px; cursor: pointer; font-weight: bold; flex-grow: 1;}
.active { background-color: #27ae60 !important; color: #000000 !important; transform: scale(1.05); border: 2px solid #1e8449 !important;}

.save-boss-btn { background: #27ae60; color: #000000; padding: 15px 30px; font-size: 1.1rem; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;}
.cancel-btn { background: #f5f7f7; color: #000000; padding: 15px 30px; font-size: 1.1rem; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-right: 10px;}
.save-btn { background: #27ae60; color: #000000; padding: 10px 15px; border: none; cursor: pointer; border-radius: 5px; font-weight: bold; font-size: 1rem;}
.save-btn.disabled { background: #95a5a6; cursor: default; }
</style>