const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Importar las rutas
const productorRoutes = require('./routes/productorRoutes');

// 1. Configurar el motor de vistas (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. Middlewares de análisis de cuerpo
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir carpetas estáticas: public y assets, y el directorio de CSS extraídos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'views/contents/css')));
app.use('/js', express.static(path.join(__dirname, 'views/contents/js')));

// Middleware personalizado para simular sesiones mediante Cookies sin paquetes externos
app.use((req, res, next) => {
    const cookies = {};
    if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts[0]) {
                cookies[parts[0].trim()] = (parts[1] || '').trim();
            }
        });
    }
    req.cookies = cookies;
    
    if (cookies.userRole) {
        req.user = {
            role: cookies.userRole, // 'admin' o 'regular'
            username: decodeURIComponent(cookies.username || 'Usuario')
        };
    } else {
        req.user = null;
    }
    
    res.locals.user = req.user; // Disponible en todos los EJS
    next();
});

// --- RUTAS DE AUTENTICACIÓN ---

// Vista de Login
app.get('/login', (req, res) => {
    if (req.user) {
        return res.redirect('/productores/listado');
    }
    res.render('login', { error: null });
});

// Procesar Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Credenciales Simples
    let role = null;
    let actualUsername = '';
    
    if (username === 'admin' && password === 'admin123') {
        role = 'admin';
        actualUsername = 'Administrador Nacional';
    } else if (username === 'user' && password === 'user123') {
        role = 'regular';
        actualUsername = 'Usuario Revisor';
    }
    
    if (role) {
        // Establecer cookies (validez por 2 horas)
        res.cookie('userRole', role, { maxAge: 2 * 60 * 60 * 1000, httpOnly: true });
        res.cookie('username', encodeURIComponent(actualUsername), { maxAge: 2 * 60 * 60 * 1000, httpOnly: true });
        return res.redirect('/productores/listado');
    } else {
        res.render('login', { error: 'Credenciales inválidas. Intente de nuevo.' });
    }
});

// Cerrar Sesión
app.get('/logout', (req, res) => {
    res.clearCookie('userRole');
    res.clearCookie('username');
    res.redirect('/login');
});

// Enlazar las rutas principales de productores
app.use('/productores', productorRoutes);

// Redirección raíz dependiente de la autenticación
app.get('/', (req, res) => {
    if (req.user) {
        res.redirect('/productores/listado');
    } else {
        res.redirect('/login');
    }
});

// Encender el servidor
app.listen(PORT, () => {
    console.log(`Server Running. Port: http://localhost:${PORT}`);
});