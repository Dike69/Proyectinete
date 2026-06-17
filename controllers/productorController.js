const Productor = require('../models/productorModel');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db'); // Para consultas directas si es necesario

// --- FUNCIONES DE NORMALIZACIÓN Y VALIDACIÓN ---

// Normalizar Cédula a formato X-XXXXXXXX
function normalizarCedula(cedulaRaw) {
    if (!cedulaRaw) return null;
    const clean = cedulaRaw.toUpperCase().replace(/[^VEJG\d]/g, '');
    const match = clean.match(/^([VEJG])?(\d+)$/);
    if (!match) return null;
    const letra = match[1] || 'V';
    const numero = match[2];
    return `${letra}-${numero}`;
}

// Normalizar Teléfono a formato 04XX-XXXXXXX
function normalizarTelefono(telRaw) {
    if (!telRaw) return null;
    let clean = telRaw.replace(/\D/g, '');
    if (clean.startsWith('58')) {
        clean = clean.substring(2);
    }
    if (clean.length === 10 && !clean.startsWith('0')) {
        clean = '0' + clean;
    }
    if (clean.length === 11 && clean.startsWith('0')) {
        return `${clean.substring(0, 4)}-${clean.substring(4)}`;
    }
    return null;
}

// Distancia de Hamming para medir similitud de hashes de 64 bits (promedio 8x8)
function getHammingDistance(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) return 999;
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        if (hash1[i] !== hash2[i]) {
            distance++;
        }
    }
    return distance;
}

// Función nativa para leer la resolución de un archivo PNG desde su Buffer
function getPngDimensions(buffer) {
    if (buffer.length < 24) return null;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    if (!isPng) return null;
    
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
}

exports.registrarProductorCompleto = async (req, res) => {
    try {
        const { nombre, apellido, cedula, telefono, email, nombre_marca, imagen_similarity_hash } = req.body;

        // Normalizar Cédula y Teléfono
        const cedulaNormalizada = normalizarCedula(cedula);
        const telefonoNormalizado = normalizarTelefono(telefono);

        if (!cedulaNormalizada) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).send('Error: La cédula ingresada es inválida. Ingrese un formato correcto (ej: V-12345678 o 12345678).');
        }

        if (!telefonoNormalizado) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).send('Error: El número de teléfono es inválido. Debe poseer 10 u 11 dígitos.');
        }

        // Validar que venga la imagen de la marca
        if (!req.file) {
            return res.status(400).send('Mano, tienes que subir o dibujar la marca en formato PNG.');
        }

        // CONSIDERACIÓN DE TAMAÑO Y FORMATO
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB
        if (req.file.size > MAX_SIZE) {
            fs.unlinkSync(req.file.path); 
            return res.status(400).send('Error: La imagen de la marca excede el límite de 2MB.');
        }

        if (req.file.mimetype !== 'image/png') {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('Error: Solo se permiten imágenes de marcas en formato PNG.');
        }

        // CONSIDERACIÓN DE RESOLUCIONES
        const fileBuffer = fs.readFileSync(req.file.path);
        const dimensions = getPngDimensions(fileBuffer);
        if (!dimensions) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('Error: La marca subida no es un PNG válido.');
        }

        const MAX_RES = 1500;
        const MIN_RES = 50;
        if (dimensions.width > MAX_RES || dimensions.height > MAX_RES || dimensions.width < MIN_RES || dimensions.height < MIN_RES) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send(`Error: Resolución no admitida. La marca debe medir entre ${MIN_RES}x${MIN_RES}px y ${MAX_RES}x${MAX_RES}px.`);
        }

        // EVALUAR COINCIDENCIAS Y PATRONES
        // A. Coincidencia Exacta (MD5)
        const hashSum = crypto.createHash('md5');
        hashSum.update(fileBuffer);
        const hashImagen = hashSum.digest('hex');

        const marcaDuplicada = await Productor.buscarMarcaPorHash(hashImagen);
        if (marcaDuplicada) {
            fs.unlinkSync(req.file.path); 
            return res.status(400).send('⚠️ Registro Rechazado: Se detectó una coincidencia exacta de píxeles con otra marca ya registrada.');
        }

        // B. Coincidencia por Similitud (Hamming)
        if (!imagen_similarity_hash || imagen_similarity_hash.length !== 64) {
            fs.unlinkSync(req.file.path);
            return res.status(400).send('Error: No se recibió la firma de similitud visual de la marca.');
        }

        const marcasExistentes = await Productor.obtenerMarcasConHashes();
        const SIMILARITY_THRESHOLD = 8;
        for (const m of marcasExistentes) {
            const dist = getHammingDistance(imagen_similarity_hash, m.imagen_similarity_hash);
            if (dist <= SIMILARITY_THRESHOLD) {
                fs.unlinkSync(req.file.path);
                return res.status(400).send(`⚠️ Registro Rechazado: La marca ingresada se parece demasiado a la marca registrada como "${m.nombre}". Intente usar otro trazo.`);
            }
        }

        // Procesar las fincas
        const { nombre_finca, id_parroquia, hectareas, sector } = req.body;
        const fincas = [];

        if (Array.isArray(nombre_finca)) {
            for (let i = 0; i < nombre_finca.length; i++) {
                if (nombre_finca[i] && nombre_finca[i].trim() !== '') {
                    fincas.push({
                        nombre_finca: nombre_finca[i].trim(),
                        id_parroquia: parseInt(id_parroquia[i]) || 1,
                        hectareas: parseFloat(hectareas[i]) || 0,
                        sector: sector[i] ? sector[i].trim() : ''
                    });
                }
            }
        } else if (nombre_finca && nombre_finca.trim() !== '') {
            fincas.push({
                nombre_finca: nombre_finca.trim(),
                id_parroquia: parseInt(id_parroquia) || 1,
                hectareas: parseFloat(hectareas) || 0,
                sector: sector ? sector.trim() : ''
            });
        }

        const imagen_path = '/uploads/' + req.file.filename;

        await Productor.registrarTodo({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            cedula: cedulaNormalizada,
            telefono: telefonoNormalizado,
            email: email ? email.trim() : null,
            nombre_marca: nombre_marca.trim(),
            imagen_path,
            imagen_hash: hashImagen,
            imagen_similarity_hash,
            fincas
        });

        res.redirect('/productores/listado');

    } catch (error) {
        console.error(error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).send('Hubo un error al registrar.');
    }
};

exports.mostrarListado = async (req, res) => {
    try {
        const rows = await Productor.obtenerListadoCompleto();
        const productoresMap = {};
        for (const row of rows) {
            const pId = row.productor_id;
            if (!productoresMap[pId]) {
                productoresMap[pId] = {
                    id: pId,
                    nombre: row.nombre,
                    apellido: row.apellido,
                    cedula: row.cedula,
                    telefono: row.telefono,
                    email: row.email,
                    activo: row.activo,
                    nombre_marca: row.nombre_marca,
                    imagen_path: row.imagen_path,
                    fincas: []
                };
            }
            if (row.finca_id) {
                productoresMap[pId].fincas.push({
                    id: row.finca_id,
                    nombre: row.nombre_finca,
                    hectareas: row.hectareas,
                    sector: row.sector,
                    parroquia: row.parroquia,
                    municipio: row.municipio,
                    estado: row.estado
                });
            }
        }
        const productores = Object.values(productoresMap);
        
        res.render('listado', { productores });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar el listado.');
    }
};

exports.toggleActivo = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        const nuevoEstado = activo == 1 || activo === true ? 1 : 0;
        await Productor.toggleActivo(id, nuevoEstado);
        res.json({ success: true, nuevoEstado });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.mostrarFormFinca = async (req, res) => {
    try {
        const { id } = req.params;
        const productor = await Productor.obtenerProductorPorId(id);
        if (!productor) {
            return res.status(404).send('Productor no encontrado.');
        }
        res.render('agregar_finca', { productor });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error de servidor.');
    }
};

exports.guardarFinca = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, id_parroquia, hectareas, sector } = req.body;
        
        await Productor.crearFinca({
            id_productor: id,
            id_parroquia: parseInt(id_parroquia) || 1,
            nombre: nombre.trim(),
            hectareas: parseFloat(hectareas) || 0,
            sector: sector ? sector.trim() : ''
        });
        
        res.redirect('/productores/listado');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al registrar la nueva finca.');
    }
};

// --- NUEVOS MÉTODOS ADMINISTRATIVOS ---

// Renderizar formulario de edición del productor y su marca
exports.mostrarFormEditarProductor = async (req, res) => {
    try {
        const { id } = req.params;
        const productor = await Productor.obtenerProductorPorId(id);
        const marca = await Productor.obtenerMarcaPorProductorId(id);
        if (!productor) {
            return res.status(404).send('Productor no encontrado.');
        }
        res.render('editar_productor', { productor, marca });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar formulario de edición.');
    }
};

// Procesar actualización del productor y su marca
exports.actualizarProductorCompleto = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, cedula, telefono, email, nombre_marca, imagen_similarity_hash, metodo_marca } = req.body;

        // Normalizar Cédula y Teléfono
        const cedulaNormalizada = normalizarCedula(cedula);
        const telefonoNormalizado = normalizarTelefono(telefono);

        if (!cedulaNormalizada || !telefonoNormalizado) {
            if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).send('Error: La cédula o el teléfono ingresados no son válidos.');
        }

        // Actualizar datos personales
        await Productor.actualizarProductor(id, {
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            cedula: cedulaNormalizada,
            telefono: telefonoNormalizado,
            email: email ? email.trim() : null
        });

        // Verificar si se subió una nueva marca (ya sea dibujada o subida)
        if (req.file) {
            // Validar nuevo archivo
            const MAX_SIZE = 2 * 1024 * 1024;
            if (req.file.size > MAX_SIZE || req.file.mimetype !== 'image/png') {
                fs.unlinkSync(req.file.path);
                return res.status(400).send('Error: Formato o tamaño no soportados (debe ser PNG menor a 2MB).');
            }

            const fileBuffer = fs.readFileSync(req.file.path);
            const dimensions = getPngDimensions(fileBuffer);
            if (!dimensions || dimensions.width > 1500 || dimensions.height > 1500 || dimensions.width < 50 || dimensions.height < 50) {
                fs.unlinkSync(req.file.path);
                return res.status(400).send('Error: Resolución no admitida (50px a 1500px).');
            }

            // Calcular MD5 para evitar copias exactas
            const hashSum = crypto.createHash('md5');
            hashSum.update(fileBuffer);
            const hashImagen = hashSum.digest('hex');

            // Verificar duplicados exactos (excluyendo al productor mismo)
            const exactoDuplicado = await Productor.buscarMarcaDuplicadaExcluyendoProductor(hashImagen, id);
            if (exactoDuplicado) {
                fs.unlinkSync(req.file.path);
                return res.status(400).send('⚠️ Registro Rechazado: Se detectó coincidencia exacta con otra marca registrada.');
            }

            // Validar Similitud Hamming (excluyendo al productor mismo)
            if (!imagen_similarity_hash || imagen_similarity_hash.length !== 64) {
                fs.unlinkSync(req.file.path);
                return res.status(400).send('Error: Hash de similitud visual inválido.');
            }

            const marcasExistentes = await Productor.obtenerMarcasConHashesExcluyendoProductor(id);
            const SIMILARITY_THRESHOLD = 8;
            for (const m of marcasExistentes) {
                const dist = getHammingDistance(imagen_similarity_hash, m.imagen_similarity_hash);
                if (dist <= SIMILARITY_THRESHOLD) {
                    fs.unlinkSync(req.file.path);
                    return res.status(400).send(`⚠️ Registro Rechazado: La nueva marca se parece demasiado a la marca registrada como "${m.nombre}".`);
                }
            }

            // Obtener la ruta de la marca vieja para borrarla
            const marcaVieja = await Productor.obtenerMarcaPorProductorId(id);
            if (marcaVieja && marcaVieja.imagen_path) {
                const rutaViejaFisica = path.join(__dirname, '../public', marcaVieja.imagen_path);
                if (fs.existsSync(rutaViejaFisica)) {
                    fs.unlinkSync(rutaViejaFisica);
                }
            }

            // Actualizar la marca en la base de datos
            const imagen_path = '/uploads/' + req.file.filename;
            await Productor.actualizarMarca(id, {
                nombre: nombre_marca.trim(),
                imagen_path,
                imagen_hash: hashImagen,
                imagen_similarity_hash
            });

        } else {
            // Si no subió foto nueva, sólo actualiza el nombre de la marca
            await Productor.actualizarMarcaNombre(id, nombre_marca.trim());
        }

        res.redirect('/productores/listado');
    } catch (error) {
        console.error(error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).send('Error al actualizar el productor.');
    }
};

// Eliminar un productor por completo en cascada
exports.eliminarProductor = async (req, res) => {
    try {
        const { id } = req.params;
        const marca = await Productor.obtenerMarcaPorProductorId(id);
        
        // Eliminar de la base de datos (se borran marcas y fincas asociadas por cascada)
        await Productor.eliminarProductor(id);

        // Borrar el archivo de imagen de disco
        if (marca && marca.imagen_path) {
            const rutaImagen = path.join(__dirname, '../public', marca.imagen_path);
            if (fs.existsSync(rutaImagen)) {
                fs.unlinkSync(rutaImagen);
            }
        }

        res.redirect('/productores/listado');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al eliminar el productor.');
    }
};

// Renderizar formulario de edición de finca
exports.mostrarFormEditarFinca = async (req, res) => {
    try {
        const { id } = req.params;
        const finca = await Productor.obtenerFincaPorId(id);
        if (!finca) {
            return res.status(404).send('Finca no encontrada.');
        }
        const productor = await Productor.obtenerProductorPorId(finca.id_productor);
        
        // Obtener la jerarquía geográfica de la parroquia actual de la finca
        const geo = await Productor.obtenerJerarquiaGeograficaPorParroquia(finca.id_parroquia) || { parroquia_id: 1, id_municipio: 1, id_estado: 1 };

        res.render('editar_finca', { finca, productor, geo });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al cargar formulario de finca.');
    }
};

// Procesar edición de finca
exports.actualizarFinca = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, id_parroquia, hectareas, sector } = req.body;
        
        await Productor.actualizarFinca(id, {
            id_parroquia: parseInt(id_parroquia) || 1,
            nombre: nombre.trim(),
            hectareas: parseFloat(hectareas) || 0,
            sector: sector.trim()
        });

        res.redirect('/productores/listado');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al actualizar la finca.');
    }
};

// Eliminar una finca
exports.eliminarFinca = async (req, res) => {
    try {
        const { id } = req.params;
        await Productor.eliminarFinca(id);
        res.redirect('/productores/listado');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al eliminar la finca.');
    }
};

// APIs para los desplegables de ubicación nacional
exports.getEstados = async (req, res) => {
    try {
        const estados = await Productor.obtenerEstados();
        res.json(estados);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMunicipios = async (req, res) => {
    try {
        const id_estado = req.query.id_estado;
        const municipios = await Productor.obtenerMunicipios(id_estado);
        res.json(municipios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getParroquias = async (req, res) => {
    try {
        const id_municipio = req.query.id_municipio;
        const parroquias = await Productor.obtenerParroquias(id_municipio);
        res.json(parroquias);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
