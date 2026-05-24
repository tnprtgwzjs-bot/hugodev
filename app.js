console.log('app.js loaded v2');
const API = location.origin;
const qs = s=>document.querySelector(s);
function on(sel, evt, handler){ const el = qs(sel); if(el) el.addEventListener(evt, handler); }
const tokenKey = 'auth_token';

let eventosStore = [];
let eventosLoaded = false;
let editingShiftId = null;

const personalList = [
  {id:1,name:'Juan Pérez',role:'Vigilante'},
  {id:2,name:'María García',role:'Vigilante'},
  {id:3,name:'Luis Rodríguez',role:'Auxiliar'},
  {id:4,name:'Ana Sánchez',role:'Auxiliar'},
  {id:5,name:'Carlos Ruiz',role:'Vigilante'}
];
const meses2026 = [
  {value:'2026-01', label:'Enero 2026'},
  {value:'2026-02', label:'Febrero 2026'},
  {value:'2026-03', label:'Marzo 2026'},
  {value:'2026-04', label:'Abril 2026'},
  {value:'2026-05', label:'Mayo 2026'},
  {value:'2026-06', label:'Junio 2026'},
  {value:'2026-07', label:'Julio 2026'},
  {value:'2026-08', label:'Agosto 2026'},
  {value:'2026-09', label:'Septiembre 2026'},
  {value:'2026-10', label:'Octubre 2026'},
  {value:'2026-11', label:'Noviembre 2026'},
  {value:'2026-12', label:'Diciembre 2026'}
];
let eventosCalendar;

function hideModal(){ const m = qs('#modal'); if(m) m.classList.add('hidden'); }
function showModal(){ const m = qs('#modal'); if(m) m.classList.remove('hidden'); }

function getToken(){ return localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey); }

async function post(path, body){
  const token = getToken();
  const res = await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json', ...(token?{'Authorization':'Bearer '+token}:{})},body:JSON.stringify(body)});
  return res.json();
}

async function put(path, body){
  const token = getToken();
  const res = await fetch(API+path,{method:'PUT',headers:{'Content-Type':'application/json', ...(token?{'Authorization':'Bearer '+token}:{})},body:JSON.stringify(body)});
  return res.json();
}

async function del(path){
  const token = getToken();
  const res = await fetch(API+path,{method:'DELETE',headers:{...(token?{'Authorization':'Bearer '+token}:{})}});
  return res.json().catch(()=>({ok:false}));
}


async function get(path){
  const token = getToken();
  const res = await fetch(API+path,{headers:{...(token?{'Authorization':'Bearer '+token}:{})}});
  return res.json();
}

function buildPersonOptions(){
  const role = qs('#eventos-role').value;
  const personSelect = qs('#eventos-person');
  if(!personSelect) return;
  personSelect.innerHTML='';
  const filtered = personalList.filter(p=>p.role===role);
  filtered.forEach(p=>{
    const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name;
    personSelect.appendChild(opt);
  });
}

function buildShiftPersonOptions(selectedId=''){
  const personSelect = qs('#shift-person');
  const roleInput = qs('#shift-role');
  if(!personSelect || !roleInput) return;
  const role = roleInput.value || 'Vigilante';
  const previousValue = selectedId !== undefined && selectedId !== null && selectedId !== '' ? String(selectedId) : personSelect.value;
  personSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Personalizado';
  personSelect.appendChild(defaultOption);
  personalList.filter(p=>p.role===role).forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    personSelect.appendChild(opt);
  });
  if(previousValue !== undefined && previousValue !== null && previousValue !== ''){
    const exists = Array.from(personSelect.options).some(opt=>opt.value === String(previousValue));
    personSelect.value = exists ? String(previousValue) : '';
  }
}

function syncShiftFormFromPerson(){
  const personSelect = qs('#shift-person');
  const nameInput = qs('#shift-name');
  const roleInput = qs('#shift-role');
  if(!personSelect || !nameInput || !roleInput) return;

  const selectedId = Number(personSelect.value);
  if(!selectedId) return;

  const person = personalList.find(p=>p.id===selectedId);
  if(!person) return;

  nameInput.value = person.name;
  roleInput.value = person.role;
  buildShiftPersonOptions(person.id);
  personSelect.value = String(person.id);
}

function getPersonFromShift(shift){
  if(!shift) return null;
  if(shift.personId){
    const byId = personalList.find(p=>String(p.id) === String(shift.personId));
    if(byId) return byId;
  }
  if(shift.personName){
    const byName = personalList.find(p=>p.name === shift.personName && (!shift.role || p.role === shift.role));
    if(byName) return byName;
    return personalList.find(p=>p.name === shift.personName) || null;
  }
  return null;
}

function initializeEventosPage(){
  const monthSelect = qs('#eventos-month');
  const roleSelect = qs('#eventos-role');
  const personSelect = qs('#eventos-person');
  if(!monthSelect || !roleSelect || !personSelect) return;

  meses2026.forEach(m=>{
    const opt = document.createElement('option'); opt.value = m.value; opt.textContent = m.label; monthSelect.appendChild(opt);
  });
  monthSelect.value = '2026-05';
  buildPersonOptions();
  buildShiftPersonOptions();
  refreshEventosData().then(()=>refreshEventosView());

  roleSelect.addEventListener('change',()=>{
    buildPersonOptions();
    buildShiftPersonOptions();
    refreshEventosView();
  });
  personSelect.addEventListener('change',()=>{
    refreshEventosView();
  });
  monthSelect.addEventListener('change',()=>{
    if(eventosCalendar){
      eventosCalendar.gotoDate(monthSelect.value + '-01');
    }
    refreshEventosView();
  });
  on('#btn-add-shift','click',()=>{
    const month = qs('#eventos-month').value || '2026-05';
    const date = month + '-01';
    openShiftDialog(date, null);
  });

  on('#btn-clear-eventos','click',async ()=>{
    const staff = getActiveStaff();
    const month = qs('#eventos-month').value;
    if(!staff || !month) return;
    const toDelete = eventosStore.filter(e=> e.start && e.start.startsWith(month) && e.role===staff.role && (e.personId===staff.id || e.personName===staff.name));
    for(const e of toDelete){
      try{ await del(`/api/eventos/${e.id}`); }catch(err){ console.error(err); }
    }
    await refreshEventosData(true);
    refreshEventosView();
  });

  on('#shift-save','click',async ()=>{ await saveShiftFromModal(); });
  on('#shift-cancel','click',closeShiftModal);
  on('#shift-close','click',closeShiftModal);
  on('#shift-role','change',()=>{
    const personSelect = qs('#shift-person');
    const currentSelection = personSelect ? personSelect.value : '';
    buildShiftPersonOptions(currentSelection);
    if(personSelect && personSelect.value){
      syncShiftFormFromPerson();
    }
  });
  on('#shift-person','change',syncShiftFormFromPerson);
  initializeEventosCalendar();
}

function getActiveStaff(){
  const personId = Number(qs('#eventos-person').value);
  return personalList.find(p=>p.id===personId) || null;
}

function calculateMonthlyHours(){
  const staff = getActiveStaff();
  const month = qs('#eventos-month').value;
  if(!staff || !month) return 0;
  return eventosStore
    .filter(e=>e.start.startsWith(month) && e.role===staff.role && (e.personId===staff.id || e.personName===staff.name))
    .reduce((sum,e)=>sum + e.duration, 0);
}

function renderEventosList(){
  const list = qs('#eventos-list');
  if(!list) return;
  const staff = getActiveStaff();
  const month = qs('#eventos-month').value;
  if(!staff || !month){ list.innerHTML='Selecciona rol y empleado para mostrar sus turnos.'; return; }

  const items = eventosStore.filter(e=>e.start.startsWith(month) && e.role===staff.role && (e.personId===staff.id || e.personName===staff.name));
  if(items.length===0){ list.innerHTML='<div class="muted">No hay turnos agregados para este mes.</div>'; return; }
  list.innerHTML='';
  items.forEach(e=>{
    const row = document.createElement('div'); row.className='tpl-item';
    row.innerHTML = `<strong>${e.title}</strong><span>${e.start} ${e.startTime} - ${e.endTime} (${e.duration}h) — ${e.building}</span>`;
    list.appendChild(row);
  });
}

function refreshEventosView(){
  const staff = getActiveStaff();
  const nameEl = qs('#selected-staff-name');
  const hoursEl = qs('#monthly-hours');
  if(nameEl){ nameEl.textContent = staff ? `${staff.name} (${staff.role})` : 'Selecciona Vigilante o Auxiliar'; }
  if(hoursEl){ hoursEl.textContent = calculateMonthlyHours(); }
  renderEventosList();
  syncEventosCalendar();
}

function syncEventosCalendar(){
  if(!eventosCalendar) return;
  const month = qs('#eventos-month').value;
  const events = eventosStore
    .filter(e=> e.start && e.start.startsWith(month))
    .map(e=>({id:e.id,title:e.title,start:e.start + 'T' + e.startTime,end:e.end + 'T' + e.endTime,extendedProps:{role:e.role,building:e.building}}));
  eventosCalendar.removeAllEvents();
  eventosCalendar.addEventSource(events);
}

function openShiftDialog(dateStr, shift=null){
  const modal = qs('#shift-modal');
  if(!modal) return;
  const nameInput = qs('#shift-name');
  const roleInput = qs('#shift-role');
  const personSelect = qs('#shift-person');
  const buildingInput = qs('#shift-building');
  const dateDisplay = qs('#shift-date');
  const startInput = qs('#shift-start');
  const endInput = qs('#shift-end');
  const titleEl = modal.querySelector('h3');

  editingShiftId = shift ? shift.id : null;

  const matchedPerson = shift ? getPersonFromShift(shift) : getActiveStaff();
  const roleValue = shift?.role || matchedPerson?.role || (qs('#eventos-role') ? qs('#eventos-role').value : 'Vigilante');

  roleInput.value = roleValue;
  buildShiftPersonOptions(matchedPerson ? matchedPerson.id : '');

  if(shift){
    if(titleEl) titleEl.textContent = 'Editar turno';
    dateDisplay.textContent = shift.start || dateStr;
    buildingInput.value = shift.building || 'Castellana 33';
    startInput.value = shift.startTime || '08:00';
    endInput.value = shift.endTime || '16:00';
    nameInput.value = shift.personName || matchedPerson?.name || '';
    roleInput.value = shift.role || matchedPerson?.role || roleValue;
    buildShiftPersonOptions(matchedPerson ? matchedPerson.id : '');
    personSelect.value = matchedPerson ? String(matchedPerson.id) : '';
  } else {
    if(titleEl) titleEl.textContent = 'Nuevo turno';
    dateDisplay.textContent = dateStr;
    buildingInput.value = 'Castellana 33';
    startInput.value = '08:00';
    endInput.value = '16:00';
    if(matchedPerson){
      nameInput.value = matchedPerson.name;
      roleInput.value = matchedPerson.role;
      buildShiftPersonOptions(matchedPerson.id);
      personSelect.value = String(matchedPerson.id);
    } else {
      nameInput.value = '';
      roleInput.value = roleValue;
      buildShiftPersonOptions('');
      personSelect.value = '';
    }
  }

  modal.classList.remove('hidden');
}


function closeShiftModal(){
  const modal = qs('#shift-modal');
  if(modal) modal.classList.add('hidden');
}

function calculateShiftDuration(startTime, endTime){
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  return Number(Math.max(0, minutes / 60).toFixed(1));
}

async function saveShiftFromModal(){
  const personSelect = qs('#shift-person');
  const selectedPersonId = personSelect && personSelect.value ? Number(personSelect.value) : null;
  const selectedPerson = selectedPersonId ? personalList.find(p=>p.id===selectedPersonId) : null;

  const nameInput = qs('#shift-name');
  const name = nameInput?.value.trim() || selectedPerson?.name || '';
  const role = qs('#shift-role')?.value || selectedPerson?.role || 'Vigilante';
  const building = qs('#shift-building')?.value;
  const startTime = qs('#shift-start')?.value;
  const endTime = qs('#shift-end')?.value;
  const date = qs('#shift-date')?.textContent;

  if(!name){ return alert('Introduce el nombre y apellidos o selecciona un empleado.'); }
  if(!startTime || !endTime){ return alert('Selecciona hora de inicio y fin.'); }
  if(!date){ return alert('Fecha inválida.'); }
  const duration = calculateShiftDuration(startTime, endTime);
  if(duration <= 0){ return alert('La hora de fin debe ser posterior a la hora de inicio.'); }

  const payload = {
    personId: selectedPerson ? selectedPerson.id : null,
    personName: name,
    role,
    building,
    start: date,
    end: date,
    startTime,
    endTime,
    title: `${role} ${name}`,
    duration
  };

  try{
    if(editingShiftId){
      await put(`/api/eventos/${editingShiftId}`, payload);
    } else {
      await post('/api/eventos', payload);
    }
  }catch(e){
    console.error(e);
    alert('Error guardando turno');
    return;
  }

  closeShiftModal();
  await refreshEventosData(true);
  refreshEventosView();
}


async function refreshEventosData(force=false){
  if(eventosLoaded && !force) return;
  try{
    const r = await get('/api/eventos');
    eventosStore = r.data || [];
    eventosLoaded = true;
  }catch(e){
    console.error('Error cargando eventos', e);
    eventosStore = [];
    eventosLoaded = true;
  }
}


function initializeEventosCalendar(){
  const calendarEl = qs('#eventos-calendar');
  if(!calendarEl) return;
  eventosCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    initialDate: '2026-05-01',
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    selectable: true,
    editable: false,
    dateClick: function(info){
      const month = qs('#eventos-month');
      if(month && !info.dateStr.startsWith(month.value)){
        month.value = info.dateStr.slice(0,7);
      }
      openShiftDialog(info.dateStr, null);
    },
    eventClick: function(info){
      const e = info.event;
      const shift = eventosStore.find(x => String(x.id) === String(e.id));
      if(!shift){
        openShiftDialog(e.startStr.slice(0,10), null);
        return;
      }
      openShiftDialog(e.startStr.slice(0,10), shift);
    },
    events: []
  });

  eventosCalendar.render();
  if(qs('#shift-modal')){
    qs('#shift-modal').addEventListener('click', e=>{ if(e.target === qs('#shift-modal')) closeShiftModal(); });
  }
}

document.querySelectorAll('a[data-page]').forEach(link=>{
  link.addEventListener('click',event=>{
    event.preventDefault();
    const target = event.currentTarget.dataset.page;
    if(target){
      switchPage(target);
      if(target==='eventos') refreshEventosView();
    }
  });
});

on('#btn-logout','click',()=>{localStorage.removeItem(tokenKey);sessionStorage.removeItem(tokenKey);window.location.href='index.html';});

function switchPage(pageId='dashboard'){
  document.querySelectorAll('.sidebar-item').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.page===pageId);
  });
  document.querySelectorAll('.page').forEach(section=>{
    section.classList.toggle('hidden-page', section.id!==pageId);
    section.classList.toggle('active-page', section.id===pageId);
  });
  if(pageId === 'eventos'){
    refreshEventosView();
    if(eventosCalendar){
      eventosCalendar.render();
      eventosCalendar.updateSize();
    }
  }
}

function initializeApp(){
  switchPage('dashboard');
  if(!calendar) initCalendar();
  initializeEventosPage();
  loadDataAll();
}

document.querySelectorAll('.sidebar-item').forEach(b=>{
  b.addEventListener('click',()=>{
    switchPage(b.dataset.page);
    if(b.dataset.page === 'eventos') refreshEventosView();
  });
});

document.querySelectorAll('.dash-card').forEach(card=>card.addEventListener('click',()=>{
  const target = card.dataset.target;
  if(target){
    switchPage(target);
  }
}));

// Cuadrantes (legacy save button may not exist in updated UI)
// Load cuadrantes (assignments) and show a simple list
async function loadCuadrantes(){
  const r = await get('/api/cuadrantes');
  const el = qs('#lista-cuadrantes'); if(!el) return;
  el.innerHTML = '';
  const data = r.data || [];
  if(data.length===0){ el.innerHTML = '<div class="muted">No hay asignaciones guardadas aún.</div>'; return; }
  data.forEach(a=>{
    const d = document.createElement('div'); d.id='item'; d.className='';
    d.innerHTML = `<strong>${a.personName || a.nombre || 'Sin nombre'}</strong> — ${a.date || a.fecha || ''} <div class="muted">${a.category || ''}</div>`;
    el.appendChild(d);
  });
}

/* ========== Cuadrantes grid + drag & drop ========== */
let plantillaCache = [];
async function loadStaffPool(){
  const pool = qs('#staff-pool');
  if(!pool) return;
  const r = await get('/api/plantilla'); plantillaCache = r.data || [];
  pool.innerHTML='';
  plantillaCache.forEach(p=>{const d=document.createElement('div'); d.className='staff-item'; d.draggable=true; d.dataset.id=p.id; d.dataset.name=p.name; d.dataset.category=p.category; d.textContent = p.name + (p.note?(' — '+p.note):''); pool.appendChild(d); d.addEventListener('dragstart',staffDragStart);});
}

function staffDragStart(e){ e.dataTransfer.setData('text/plain', JSON.stringify({id:this.dataset.id,name:this.dataset.name,category:this.dataset.category})); }

on('#btn-generate-grid','click',generateGrid);

function generateGrid(){
  const month = qs('#cq-month').value; if(!month) return alert('Selecciona mes');
  const [y,m] = month.split('-').map(Number);
  const days = new Date(y,m,0).getDate();
  const grid = qs('#cuadrante-grid'); grid.innerHTML='';
  const header = document.createElement('div'); header.className='day-row';
  for(let d=1; d<=days; d++){ const hd=document.createElement('div'); hd.className='day-cell'; hd.innerHTML=`<strong>${d}/${m}/${y}</strong>`; header.appendChild(hd); }
  grid.appendChild(header);
  plantillaCache.forEach(p=>{
    const row = document.createElement('div'); row.className='day-row';
    for(let d=1; d<=days; d++){
      const cell = document.createElement('div'); cell.className='day-cell'; cell.dataset.date=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cell.addEventListener('dragover',e=>e.preventDefault());
      cell.addEventListener('drop',async function(e){ e.preventDefault(); const data = JSON.parse(e.dataTransfer.getData('text/plain')); const assign = {personId:data.id,personName:data.name,category:data.category,date:this.dataset.date}; const r = await post('/api/cuadrantes',assign); if(r.ok){ const a = document.createElement('div'); a.className='assignment'; a.textContent = data.name; this.appendChild(a); }});
      row.appendChild(cell);
    }
    const left = document.createElement('div'); left.style.width='160px'; left.style.padding='6px'; left.innerHTML=`<strong>${p.name}</strong>`;
    grid.appendChild(left);
    grid.appendChild(row);
  });
}

// export cuadrante: read /api/cuadrantes and create XLSX or PDF
on('#btn-export-cuadrante-xlsx','click',async ()=>{
  const r = await get('/api/cuadrantes'); const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(r.data||[]); XLSX.utils.book_append_sheet(wb,ws,'Cuadrantes'); XLSX.writeFile(wb,'cuadrantes.xlsx');
});

on('#btn-export-cuadrante-pdf','click',async ()=>{
  const r = await get('/api/cuadrantes'); const {jsPDF}=window.jspdf; const doc=new jsPDF({orientation:'landscape'}); let y=10; doc.setFontSize(12); doc.text('Cuadrantes',10,y); y+=8; (r.data||[]).forEach(c=>{doc.text(`${c.personName} — ${c.date} — ${c.category}`,10,y); y+=6}); doc.save('cuadrantes.pdf');
});


// Eventos
on('#btn-save-evento','click',async ()=>{
  const data={nombre:qs('#ev-nombre')?qs('#ev-nombre').value:'',fecha:qs('#ev-fecha')?qs('#ev-fecha').value:'',importe:parseFloat(qs('#ev-importe')?qs('#ev-importe').value||0:0)};
  const r = await post('/api/eventos',data);
  if(r.ok){loadEventos(); alert('Evento guardado');} else alert('Error: '+(r.error||''));
});
async function loadEventos(){
  const el = qs('#lista-eventos');
  if(!el) return;
  const r = await get('/api/eventos');
  el.innerHTML = '';
  (r.data||[]).forEach(ev=>{const d=document.createElement('div');d.id='item';d.innerHTML=`<strong>${ev.nombre}</strong> — ${ev.fecha} — ${ev.importe} €`; el.appendChild(d)});
}

on('#btn-export-evento-pdf','click',async ()=>{const r=await get('/api/eventos'); const {jsPDF}=window.jspdf; const doc=new jsPDF(); let y=10; doc.text('Facturación de eventos',10,y); y+=8; (r.data||[]).forEach(c=>{doc.text(`${c.nombre} — ${c.fecha} — ${c.importe} €`,10,y); y+=6}); doc.save('eventos.pdf');});

on('#btn-export-evento-xlsx','click',async ()=>{const r=await get('/api/eventos'); const wb=XLSX.utils.book_new(); const ws=XLSX.utils.json_to_sheet(r.data||[]); XLSX.utils.book_append_sheet(wb,ws,'Eventos'); XLSX.writeFile(wb,'eventos.xlsx');});

async function loadData(){await loadCuadrantes(); await loadEventos();}

async function loadDataAll(){ await loadCuadrantes(); await loadEventos(); await loadPlantilla(); }

// Note: data load and calendar initialization handled after login to avoid accidental modal openings

/* ========== Facturación: FullCalendar ========== */
let calendar;
function initCalendar(){
  const calendarEl = document.getElementById('calendar');
  if(!calendarEl) return;
  calendar = new FullCalendar.Calendar(calendarEl,{
    initialView: 'dayGridMonth',
    initialDate: '2026-01-01',
    validRange: { start: '2026-01-01', end: '2026-12-31' },
    headerToolbar:{left:'prev,next today',center:'title',right:'dayGridMonth'},
    navLinks:false,
    selectable:false,
    editable:false,
    events: async function(fetchInfo, successCallback){
      const r = await get('/api/facturacion');
      const evs = (r.data||[]).map(e=>({id:e.id,title:e.title,start:e.start,end:e.end,extendedProps:{role:e.role,desc:e.desc,loc:e.loc}}));
      successCallback(evs);
    },
    dateClick: function(info){
      openModalForDate(info.dateStr);
    },
    eventClick: function(info){
      const e = info.event;
      alert(`${e.title}\n${e.extendedProps.role}\n${e.extendedProps.desc||''}\n${e.extendedProps.loc||''}`);
    }
  });
  calendar.render();
  hideModal();
}

function openModalForDate(dateStr){
  qs('#modal').classList.remove('hidden');
  qs('#m-start').value = dateStr;
  qs('#m-end').value = dateStr;
}

on('#m-cancel','click',()=>qs('#modal')&&qs('#modal').classList.add('hidden'));
// Close modal when clicking backdrop
on('#modal','click',(e)=>{ if(e.target === qs('#modal')) qs('#modal').classList.add('hidden'); });
// Close modal on Esc
document.addEventListener('keydown',(e)=>{ if(e.key === 'Escape'){ const m=qs('#modal'); if(m) m.classList.add('hidden'); } });
on('#m-save','click',async ()=>{
  const title = qs('#m-title').value||'Sin título';
  const desc = qs('#m-desc').value;
  const loc = qs('#m-loc').value;
  const role = qs('#m-role').value;
  const start = qs('#m-start').value + 'T' + (qs('#m-start-time').value||'00:00');
  const end = qs('#m-end').value + 'T' + (qs('#m-end-time').value||'23:59');
  const r = await post('/api/facturacion',{title,desc,loc,role,start,end});
  if(r.ok){ const m=qs('#modal'); if(m) m.classList.add('hidden'); calendar.refetchEvents(); alert('Entrada guardada'); }
  else alert('Error guardando: '+(r.error||''));
});

/* ========== Plantilla ========== */
async function loadPlantilla(){
  const cps = qs('#tpl-cps');
  if(!cps) return;
  const ext = qs('#tpl-exterior');
  const aux = qs('#tpl-aux');
  if(!ext || !aux) return;
  const r = await get('/api/plantilla');
  cps.innerHTML = '';
  ext.innerHTML = '';
  aux.innerHTML = '';
  (r.data||[]).forEach(p=>{
    const d=document.createElement('div'); d.className='tpl-item'; d.textContent = p.name + (p.note? (' — '+p.note):'');
    const del = document.createElement('button'); del.textContent='✖'; del.addEventListener('click',async ()=>{ await post('/api/plantilla/delete',{id:p.id}); loadPlantilla(); });
    d.appendChild(del);
    if(p.category==='cps') cps.appendChild(d);
    else if(p.category==='exterior') ext.appendChild(d);
    else aux.appendChild(d);
  });
  await loadStaffPool();
}

on('#add-cps','click',async ()=>{ const name=prompt('Nombre'); if(!name) return; await post('/api/plantilla',{name,category:'cps'}); loadPlantilla(); });
on('#add-exterior','click',async ()=>{ const name=prompt('Nombre'); if(!name) return; await post('/api/plantilla',{name,category:'exterior'}); loadPlantilla(); });
on('#add-aux','click',async ()=>{ const name=prompt('Nombre'); if(!name) return; await post('/api/plantilla',{name,category:'aux'}); loadPlantilla(); });

/* Inicializaciones */
window.addEventListener('load',()=>{
  if(!getToken()){
    window.location.href = 'index.html';
    return;
  }
  initializeApp();
});
