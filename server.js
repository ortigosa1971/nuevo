
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();

// CSP para permitir Google Translate y estilos externos
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://www.gstatic.com; script-src 'self' 'unsafe-inline' https://translate.google.com https://www.gstatic.com; frame-src 'self' https://translate.google.com"
  );
  next();
});

const db = new sqlite3.Database('./db/usuarios.db', (err) => {
  if (err) console.error("❌ Error al conectar con la base de datos:", err.message);
  else console.log("✅ Conectado a la base de datos usuarios.db");
});

// Configuración de sesión
app.use(session({
  secret: 'tu_secreto',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 }
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas protegidas
app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'views', 'inicio.html'));
});

app.get('/inicio.html', (req, res) => {
  if (!req.session.user) return res.redirect('/login.html');
  res.sendFile(path.join(__dirname, 'views', 'inicio.html'));
});

// Verificación de sesión
app.get('/verificar-sesion', (req, res) => {
  if (!req.session.user) return res.sendStatus(401);

  db.get('SELECT session_id FROM users WHERE username = ?', [req.session.user.username], (err, row) => {
    if (err) return req.session.destroy(() => res.sendStatus(500));
    if (!row || row.session_id !== req.sessionID)
      return req.session.destroy(() => res.sendStatus(401));
    res.sendStatus(200);
  });
});

// Login
app.post('/login', (req, res) => {
  const { usuario } = req.body;

  if (!usuario || usuario.trim() === "") return res.redirect('/login.html?error=1');

  db.get('SELECT * FROM users WHERE username = ?', [usuario], (err, row) => {
    if (err || !row) return res.redirect('/login.html?error=1');

    db.run('UPDATE users SET session_id = NULL WHERE username = ?', [usuario], (err) => {
      if (err) return res.redirect('/login.html?error=1');

      req.session.user = { username: row.username };
      db.run('UPDATE users SET session_id = ? WHERE username = ?', [req.sessionID, row.username], (err) => {
        if (err) return res.redirect('/login.html?error=1');
        res.redirect('/inicio.html');
      });
    });
  });
});

// Datos meteorológicos reales desde Weather Underground
app.get('/clima', async (req, res) => {
  try {
    const API_KEY = "e19cf0d935fc49329cf0d935fc5932cc";
    const STATION_ID = "IALFAR30";
    const url = `https://api.weather.com/v2/pws/observations/current?stationId=${STATION_ID}&format=json&units=m&apiKey=${API_KEY}`;
    const response = await axios.get(url);
    const obs = response.data.observations?.[0];

    if (!obs) return res.status(404).json({ error: "No hay datos disponibles." });

    const metric = obs.metric || {};
    const weatherData = {
      temperatura: metric.temp,
      humedad: obs.humidity,
      viento: metric.windSpeed,
      presion: metric.pressure,
      lluvia: metric.precipTotal
    };

    res.json(weatherData);
  } catch (error) {
    console.error("❌ Error al consultar la API:", error.message);
    res.status(500).json({ error: "Error al obtener datos." });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor escuchando en puerto ${PORT}`));

