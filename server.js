
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname,'db.json');
const SECRET = process.env.JWT_SECRET || 'cambiar_esta_clave_en_produccion';

const readDB = ()=>{if(!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH,JSON.stringify({users:[],cuadrantes:[],eventos:[],facturacion:[],plantilla:[]},null,2)); return JSON.parse(fs.readFileSync(DB_PATH));}
const writeDB = (d)=>fs.writeFileSync(DB_PATH,JSON.stringify(d,null,2));

const app = express(); app.use(cors()); app.use(express.json()); app.use(express.static(path.join(__dirname)));

function auth(req,res,next){
	const h=req.headers.authorization; if(!h) return res.status(401).json({error:'No autorizado'});
	const parts=h.split(' '); if(parts.length!==2) return res.status(401).json({error:'Token inválido'});
	const token=parts[1]; try{const p=jwt.verify(token,SECRET); req.user=p; next()}catch(e){return res.status(401).json({error:'Token inválido'})}
}

// Registro deshabilitado por defecto. Para permitir, establezca ALLOW_REGISTRATION=true en el entorno.
app.post('/api/register',(req,res)=>{
	if(process.env.ALLOW_REGISTRATION!=='true') return res.status(403).json({error:'Registro deshabilitado'});
	const {username,password}=req.body; if(!username||!password) return res.json({error:'usuario/contraseña requerido'});
	const db=readDB(); if(db.users.find(u=>u.username===username)) return res.json({error:'usuario ya existe'});
	const hash=bcrypt.hashSync(password,10); db.users.push({username,hash}); writeDB(db); res.json({ok:true});
});

app.post('/api/login',(req,res)=>{
	const {username,password}=req.body; if(!username||!password) return res.json({error:'usuario/contraseña requerido'});
	const db=readDB(); const u=db.users.find(x=>x.username===username); if(!u) return res.json({error:'usuario no encontrado'});
	if(!bcrypt.compareSync(password,u.hash)) return res.json({error:'credenciales inválidas'});
	const token=jwt.sign({username},SECRET,{expiresIn:'8h'});
	res.json({token, mustChangePassword: !!u.mustChangePassword});
});

app.get('/api/cuadrantes',auth,(req,res)=>{const db=readDB(); res.json({data:db.cuadrantes});});
app.post('/api/cuadrantes',auth,(req,res)=>{const db=readDB(); const item={id:Date.now(),...req.body}; db.cuadrantes.push(item); writeDB(db); res.json({ok:true,item});});

app.get('/api/eventos',auth,(req,res)=>{const db=readDB(); res.json({data:db.eventos});});
app.post('/api/eventos',auth,(req,res)=>{const db=readDB(); const item={id:Date.now(),...req.body}; db.eventos.push(item); writeDB(db); res.json({ok:true,item});});
app.put('/api/eventos/:id',auth,(req,res)=>{
	const {id} = req.params;
	const db = readDB();
	const idx = db.eventos.findIndex(e => String(e.id) === String(id));
	if(idx === -1) return res.status(404).json({error:'Evento no encontrado'});
	const updated = {...db.eventos[idx], ...req.body, id: db.eventos[idx].id};
	db.eventos[idx] = updated;
	writeDB(db);
	res.json({ok:true,item:updated});
});
app.delete('/api/eventos/:id',auth,(req,res)=>{
	const {id} = req.params;
	const db = readDB();
	const before = db.eventos.length;
	db.eventos = db.eventos.filter(e => String(e.id) !== String(id));
	const after = db.eventos.length;
	if(before === after) return res.status(404).json({error:'Evento no encontrado'});
	writeDB(db);
	res.json({ok:true});
});


app.post('/api/change-password',auth,(req,res)=>{
	const {password} = req.body; if(!password) return res.json({error:'password requerido'});
	const db = readDB(); const u = db.users.find(x=>x.username===req.user.username); if(!u) return res.status(400).json({error:'usuario no encontrado'});
	u.hash = bcrypt.hashSync(password,10);
	u.mustChangePassword = false;
	writeDB(db);
	res.json({ok:true});
});

// Facturación (horarios/events)
app.get('/api/facturacion',auth,(req,res)=>{const db=readDB(); res.json({data:db.facturacion});});
app.post('/api/facturacion',auth,(req,res)=>{const db=readDB(); const item={id:Date.now(),...req.body}; db.facturacion.push(item); writeDB(db); res.json({ok:true,item});});

// Plantilla (staff lists)
app.get('/api/plantilla',auth,(req,res)=>{const db=readDB(); res.json({data:db.plantilla});});
app.post('/api/plantilla',auth,(req,res)=>{const db=readDB(); const item={id:Date.now(),...req.body}; db.plantilla.push(item); writeDB(db); res.json({ok:true,item});});
app.post('/api/plantilla/delete',auth,(req,res)=>{const {id}=req.body; const db=readDB(); db.plantilla = db.plantilla.filter(p=>p.id!=id); writeDB(db); res.json({ok:true});});

function ensureAdmin(){
	const db=readDB();
	const exists = db.users && db.users.find(u=>u.username==='admin');
	if(exists) return;
	const pwd = process.env.ADMIN_PWD || crypto.randomBytes(6).toString('base64').replace(/\/+|\=+/g,'').slice(0,10);
	const hash = bcrypt.hashSync(pwd,10);
	db.users.push({username:'admin',hash});
	writeDB(db);
	const info = `Usuario admin creado\nUsuario: admin\nContraseña: ${pwd}\nCambia la contraseña al iniciar sesión.\n`;
	try{fs.writeFileSync(path.join(__dirname,'admin_credentials.txt'),info);}catch(e){}
	console.log('ADMIN creado. Revisa admin_credentials.txt para credenciales.');
}

ensureAdmin();

const PORT = process.env.PORT || 3000; app.listen(PORT,()=>console.log('Servidor iniciado en http://localhost:'+PORT));
