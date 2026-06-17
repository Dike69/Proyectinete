// Funciones de validación, normalización, aHash y geografía compartidas

function normalizarCedulaJS(cedulaRaw) {
    if (!cedulaRaw) return null;
    const clean = cedulaRaw.toUpperCase().replace(/[^VEJG\d]/g, '');
    const match = clean.match(/^([VEJG])?(\d+)$/);
    if (!match) return null;
    const letra = match[1] || 'V';
    const numero = match[2];
    return `${letra}-${numero}`;
}

function normalizarTelefonoJS(telRaw) {
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

// Algoritmo de firma visual aHash de 64 bits con Bounding Box Cropping
function computeAHash(imageOrCanvas) {
    let srcCanvas = imageOrCanvas;
    
    if (imageOrCanvas instanceof HTMLImageElement) {
        srcCanvas = document.createElement('canvas');
        srcCanvas.width = 250;
        srcCanvas.height = 250;
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.fillStyle = "#ffffff";
        srcCtx.fillRect(0, 0, 250, 250);
        srcCtx.drawImage(imageOrCanvas, 0, 0, 250, 250);
    }
    
    const srcCtx = srcCanvas.getContext('2d');
    const imgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const data = imgData.data;
    let minX = srcCanvas.width, maxX = 0, minY = srcCanvas.height, maxY = 0;
    let found = false;
    
    for (let y = 0; y < srcCanvas.height; y++) {
        for (let x = 0; x < srcCanvas.width; x++) {
            const idx = (y * srcCanvas.width + x) * 4;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const a = data[idx+3];
            const isStroke = (r < 220 || g < 220 || b < 220) && (a > 50);
            if (isStroke) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 8;
    tempCanvas.height = 8;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, 8, 8);
    
    if (found) {
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        tempCtx.drawImage(srcCanvas, minX, minY, w, h, 0, 0, 8, 8);
    } else {
        tempCtx.drawImage(srcCanvas, 0, 0, 8, 8);
    }
    
    const resData = tempCtx.getImageData(0, 0, 8, 8).data;
    let grayValues = [];
    let sum = 0;
    for (let i = 0; i < 64; i++) {
        const r = resData[i * 4];
        const g = resData[i * 4 + 1];
        const b = resData[i * 4 + 2];
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        grayValues.push(gray);
        sum += gray;
    }
    const average = sum / 64;
    
    let hash = '';
    for (let i = 0; i < 64; i++) {
        hash += (grayValues[i] >= average) ? '1' : '0';
    }
    return hash;
}

// Inicializar ubicaciones dinámicas de Estados, Municipios y Parroquias
function inicializarUbicacionesFinca(fincaCard) {
    const selectEstado = fincaCard.querySelector('.select-estado');
    const selectMunicipio = fincaCard.querySelector('.select-municipio');
    const selectParroquia = fincaCard.querySelector('.select-parroquia');

    // Limpiar opciones de estado previas para evitar duplicados al clonar la tarjeta de finca
    selectEstado.innerHTML = '<option value="">Seleccione Estado...</option>';

    fetch('/productores/api/estados')
        .then(res => res.json())
        .then(estados => {
            estados.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.id;
                opt.textContent = est.nombre;
                selectEstado.appendChild(opt);
            });
        });

    selectEstado.addEventListener('change', () => {
        const idEstado = selectEstado.value;
        selectMunicipio.innerHTML = '<option value="">Seleccione Municipio...</option>';
        selectParroquia.innerHTML = '<option value="">Seleccione Parroquia...</option>';
        selectMunicipio.disabled = true;
        selectParroquia.disabled = true;

        if (!idEstado) return;

        fetch(`/productores/api/municipios?id_estado=${idEstado}`)
            .then(res => res.json())
            .then(municipios => {
                municipios.forEach(mun => {
                    const opt = document.createElement('option');
                    opt.value = mun.id;
                    opt.textContent = mun.nombre;
                    selectMunicipio.appendChild(opt);
                });
                selectMunicipio.disabled = false;
            });
    });

    selectMunicipio.addEventListener('change', () => {
        const idMunicipio = selectMunicipio.value;
        selectParroquia.innerHTML = '<option value="">Seleccione Parroquia...</option>';
        selectParroquia.disabled = true;

        if (!idMunicipio) return;

        fetch(`/productores/api/parroquias?id_municipio=${idMunicipio}`)
            .then(res => res.json())
            .then(parroquias => {
                parroquias.forEach(parq => {
                    const opt = document.createElement('option');
                    opt.value = parq.id;
                    opt.textContent = parq.nombre;
                    selectParroquia.appendChild(opt);
                });
                selectParroquia.disabled = false;
            });
    });
}
