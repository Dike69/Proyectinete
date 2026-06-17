const db = require('../config/db');

const Productor = {
    // 1. Registra todo junto usando transacciones (soporta múltiples fincas, sin coordenadas y con hash de similitud)
    registrarTodo: async (datos) => {
        const connection = await db.getConnection(); // Pedimos una conexión exclusiva
        try {
            await connection.beginTransaction(); // Iniciamos la transacción

            // A. Insertar Productor
            const sqlProductor = `INSERT INTO productores (nombre, apellido, cedula, telefono, email) VALUES (?, ?, ?, ?, ?)`;
            const [resProductor] = await connection.execute(sqlProductor, [
                datos.nombre, datos.apellido, datos.cedula, datos.telefono, datos.email
            ]);
            const id_productor = resProductor.insertId;

            // B. Insertar Fincas (Múltiples) - Sin coordenadas
            const sqlFinca = `INSERT INTO fincas (id_productor, id_parroquia, nombre, hectareas, sector) 
                             VALUES (?, ?, ?, ?, ?)`;
            if (datos.fincas && datos.fincas.length > 0) {
                for (const finca of datos.fincas) {
                    await connection.execute(sqlFinca, [
                        id_productor,
                        finca.id_parroquia,
                        finca.nombre_finca,
                        finca.hectareas,
                        finca.sector
                    ]);
                }
            }

            // C. Insertar Marca (Una sola por productor) - Con hash de similitud
            const sqlMarca = `INSERT INTO marcas (id_productor, nombre, imagen_path, imagen_hash, imagen_similarity_hash) VALUES (?, ?, ?, ?, ?)`;
            await connection.execute(sqlMarca, [
                id_productor, 
                datos.nombre_marca, 
                datos.imagen_path, 
                datos.imagen_hash,
                datos.imagen_similarity_hash
            ]);

            await connection.commit(); // Si todo salió fino, guardamos en la BD
            return id_productor;
        } catch (error) {
            await connection.rollback(); // Si algo falló, deshacemos todo lo que se hizo a medias
            throw error; // Escupimos el error para que el controlador lo vea
        } finally {
            connection.release(); // Soltamos la conexión para que no se quede pegada
        }
    },

    // 2. Registrar una finca individual para un productor existente (Sin coordenadas)
    crearFinca: async (datosFinca) => {
        const sql = `INSERT INTO fincas (id_productor, id_parroquia, nombre, hectareas, sector) 
                     VALUES (?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [
            datosFinca.id_productor, 
            datosFinca.id_parroquia, 
            datosFinca.nombre, 
            datosFinca.hectareas, 
            datosFinca.sector
        ]);
        return result;
    },

    // 3. Buscar una marca por su HASH MD5 (Para evitar duplicados exactos)
    buscarMarcaPorHash: async (hash) => {
        const sql = `SELECT * FROM marcas WHERE imagen_hash = ?`;
        const [rows] = await db.execute(sql, [hash]);
        return rows[0];
    },

    // 4. Obtener todas las marcas registradas con sus hashes de similitud (Para el sistema de parecidos)
    obtenerMarcasConHashes: async () => {
        const sql = `SELECT nombre, imagen_similarity_hash FROM marcas`;
        const [rows] = await db.execute(sql);
        return rows;
    },

    // 5. Obtener listado de todos los productores (para el reporte completo con fincas y marcas, sin coordenadas)
    obtenerListadoCompleto: async () => {
        const sql = `
            SELECT 
                p.id AS productor_id, p.nombre, p.apellido, p.cedula, p.telefono, p.email, p.activo,
                f.id AS finca_id, f.nombre AS nombre_finca, f.hectareas, f.sector,
                pa.nombre AS parroquia, m.nombre AS municipio, e.nombre AS estado,
                mar.nombre AS nombre_marca, mar.imagen_path
            FROM productores p
            LEFT JOIN fincas f ON p.id = f.id_productor
            LEFT JOIN parroquias pa ON f.id_parroquia = pa.id
            LEFT JOIN municipios m ON pa.id_municipio = m.id
            LEFT JOIN estados e ON m.id_estado = e.id
            LEFT JOIN marcas mar ON p.id = mar.id_productor
            ORDER BY p.fecha_registro DESC
        `;
        const [rows] = await db.execute(sql);
        return rows;
    },

    // 6. Cambiar el estado activo (Activar / Desactivar)
    toggleActivo: async (id, nuevoEstado) => {
        const sql = `UPDATE productores SET activo = ? WHERE id = ?`;
        const [result] = await db.execute(sql, [nuevoEstado, id]);
        return result;
    },

    // 7. Obtener un productor por su ID
    obtenerProductorPorId: async (id) => {
        const sql = `SELECT * FROM productores WHERE id = ?`;
        const [rows] = await db.execute(sql, [id]);
        return rows[0];
    },

    // 8. Actualizar productor
    actualizarProductor: async (id, datos) => {
        const sql = `UPDATE productores SET nombre = ?, apellido = ?, cedula = ?, telefono = ?, email = ? WHERE id = ?`;
        const [result] = await db.execute(sql, [datos.nombre, datos.apellido, datos.cedula, datos.telefono, datos.email, id]);
        return result;
    },

    // 9. Obtener marca por ID de productor
    obtenerMarcaPorProductorId: async (id_productor) => {
        const sql = `SELECT * FROM marcas WHERE id_productor = ?`;
        const [rows] = await db.execute(sql, [id_productor]);
        return rows[0];
    },

    // 10. Actualizar marca de ganado (con foto nueva)
    actualizarMarca: async (id_productor, datosMarca) => {
        const sql = `UPDATE marcas SET nombre = ?, imagen_path = ?, imagen_hash = ?, imagen_similarity_hash = ? WHERE id_productor = ?`;
        const [result] = await db.execute(sql, [
            datosMarca.nombre,
            datosMarca.imagen_path,
            datosMarca.imagen_hash,
            datosMarca.imagen_similarity_hash,
            id_productor
        ]);
        return result;
    },

    // 11. Actualizar solo nombre de la marca
    actualizarMarcaNombre: async (id_productor, nombre) => {
        const sql = `UPDATE marcas SET nombre = ? WHERE id_productor = ?`;
        const [result] = await db.execute(sql, [nombre, id_productor]);
        return result;
    },

    // 12. Eliminar productor en cascada
    eliminarProductor: async (id) => {
        const sql = `DELETE FROM productores WHERE id = ?`;
        const [result] = await db.execute(sql, [id]);
        return result;
    },

    // 13. Obtener finca por su ID
    obtenerFincaPorId: async (id) => {
        const sql = `SELECT * FROM fincas WHERE id = ?`;
        const [rows] = await db.execute(sql, [id]);
        return rows[0];
    },

    // 14. Actualizar finca
    actualizarFinca: async (id, datosFinca) => {
        const sql = `UPDATE fincas SET id_parroquia = ?, nombre = ?, hectareas = ?, sector = ? WHERE id = ?`;
        const [result] = await db.execute(sql, [
            datosFinca.id_parroquia,
            datosFinca.nombre,
            datosFinca.hectareas,
            datosFinca.sector,
            id
        ]);
        return result;
    },

    // 15. Eliminar finca
    eliminarFinca: async (id) => {
        const sql = `DELETE FROM fincas WHERE id = ?`;
        const [result] = await db.execute(sql, [id]);
        return result;
    },

    // 16. API de ubicaciones geográficas a nivel nacional
    obtenerEstados: async () => {
        const [rows] = await db.execute('SELECT * FROM estados ORDER BY nombre ASC');
        return rows;
    },

    obtenerMunicipios: async (id_estado) => {
        const [rows] = await db.execute('SELECT * FROM municipios WHERE id_estado = ? ORDER BY nombre ASC', [id_estado]);
        return rows;
    },

    obtenerParroquias: async (id_municipio) => {
        const [rows] = await db.execute('SELECT * FROM parroquias WHERE id_municipio = ? ORDER BY nombre ASC', [id_municipio]);
        return rows;
    },

    // 17. Buscar marca duplicada excluyendo al productor actual (Edición)
    buscarMarcaDuplicadaExcluyendoProductor: async (hash, id_productor) => {
        const sql = `SELECT * FROM marcas WHERE imagen_hash = ? AND id_productor != ?`;
        const [rows] = await db.execute(sql, [hash, id_productor]);
        return rows[0];
    },

    // 18. Obtener firmas visuales Hamming excluyendo al productor actual (Edición)
    obtenerMarcasConHashesExcluyendoProductor: async (id_productor) => {
        const sql = `SELECT nombre, imagen_similarity_hash FROM marcas WHERE id_productor != ?`;
        const [rows] = await db.execute(sql, [id_productor]);
        return rows;
    },

    // 19. Obtener jerarquía geográfica completa por ID de parroquia
    obtenerJerarquiaGeograficaPorParroquia: async (id_parroquia) => {
        const sql = `
            SELECT pa.id AS parroquia_id, pa.id_municipio, m.id_estado 
            FROM parroquias pa
            JOIN municipios m ON pa.id_municipio = m.id
            WHERE pa.id = ?
        `;
        const [rows] = await db.execute(sql, [id_parroquia]);
        return rows[0];
    }
};

module.exports = Productor;