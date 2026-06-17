const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const productorController = require('../controllers/productorController');

// --- MIDDLEWARES DE AUTENTICACIÓN ---

// Requerir que el usuario haya iniciado sesión (cualquier rol)
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    next();
};

// Requerir que el usuario sea administrador
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    if (req.user.role !== 'admin') {
        return res.status(403).send('Acceso denegado: Se requiere rol de Administrador para realizar esta acción.');
    }
    next();
};

// Configuración de Multer para guardar las imágenes de las marcas
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'marca-' + uniqueSuffix + '.png');
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(new Error('Formato no soportado. ¡Solo se permiten imágenes PNG, mano!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter
});

// --- RUTAS DE PRODUCTORES ---

// 1. Ver formulario de registro (Solo Administrador)
router.get('/registrar', requireAdmin, (req, res) => {
    res.render('registrar'); 
});

// 2. Procesar el formulario de registro (Solo Administrador)
router.post('/registrar', requireAdmin, (req, res, next) => {
    upload.single('imagen_marca')(req, res, (err) => {
        if (err) {
            return res.status(400).send(`Error de subida: ${err.message}`);
        }
        next();
    });
}, productorController.registrarProductorCompleto);

// 3. Ver listado general (Revisores y Administradores)
router.get('/listado', requireAuth, productorController.mostrarListado);

// 4. Cambiar estado activo (Solo Administrador)
router.post('/toggle-activo/:id', requireAdmin, productorController.toggleActivo);

// 5. Agregar finca adicional (Solo Administrador)
router.get('/agregar-finca/:id', requireAdmin, productorController.mostrarFormFinca);
router.post('/agregar-finca/:id', requireAdmin, productorController.guardarFinca);

// 6. Editar productor y marca (Solo Administrador)
router.get('/editar/:id', requireAdmin, productorController.mostrarFormEditarProductor);
router.post('/editar/:id', requireAdmin, (req, res, next) => {
    upload.single('imagen_marca')(req, res, (err) => {
        if (err) {
            return res.status(400).send(`Error de subida: ${err.message}`);
        }
        next();
    });
}, productorController.actualizarProductorCompleto);

// 7. Eliminar productor (Solo Administrador)
router.post('/eliminar/:id', requireAdmin, productorController.eliminarProductor);

// 8. Editar finca (Solo Administrador)
router.get('/editar-finca/:id', requireAdmin, productorController.mostrarFormEditarFinca);
router.post('/editar-finca/:id', requireAdmin, productorController.actualizarFinca);

// 9. Eliminar finca (Solo Administrador)
router.post('/eliminar-finca/:id', requireAdmin, productorController.eliminarFinca);

// --- ENDPOINTS DE API GEOGRÁFICA NACIONAL ---
router.get('/api/estados', requireAuth, productorController.getEstados);
router.get('/api/municipios', requireAuth, productorController.getMunicipios);
router.get('/api/parroquias', requireAuth, productorController.getParroquias);

module.exports = router;