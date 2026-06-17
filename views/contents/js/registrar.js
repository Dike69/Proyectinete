// --- Lógica del Canvas ---
    const canvas = document.getElementById('canvas_marca');
    const ctx = canvas.getContext('2d');
    let dibujando = false;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    canvas.addEventListener('mousedown', () => dibujando = true);
    canvas.addEventListener('mouseup', () => {
        dibujando = false;
        ctx.beginPath();
    });
    canvas.addEventListener('mousemove', dibujar);

    function dibujar(event) {
        if (!dibujando) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    document.getElementById('btn-limpiar').addEventListener('click', () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
    });

    // --- Alternar Métodos de Marca ---
    const radioDibujar = document.querySelector('input[value="dibujar"]');
    const radioSubir = document.querySelector('input[value="subir"]');
    const canvasContenedor = document.getElementById('canvas-contenedor');
    const uploadContenedor = document.getElementById('upload-contenedor');

    radioDibujar.addEventListener('change', () => {
        canvasContenedor.style.display = 'block';
        uploadContenedor.style.display = 'none';
    });

    radioSubir.addEventListener('change', () => {
        canvasContenedor.style.display = 'none';
        uploadContenedor.style.display = 'block';
    });

    // --- Normalizadores ---
    

    

    const inputCedula = document.querySelector('input[name="cedula"]');
    inputCedula.addEventListener('blur', () => {
        const norm = normalizarCedulaJS(inputCedula.value);
        if (norm) {
            inputCedula.value = norm;
            inputCedula.setCustomValidity('');
        }
    });

    const inputTelefono = document.querySelector('input[name="telefono"]');
    inputTelefono.addEventListener('blur', () => {
        const norm = normalizarTelefonoJS(inputTelefono.value);
        if (norm) {
            inputTelefono.value = norm;
            inputTelefono.setCustomValidity('');
        }
    });

    // --- aHash con Bounding Box ---
    

    // --- Ubicaciones dinámicas ---
    

    const primerFincaCard = document.querySelector('.finca-card');
    inicializarUbicacionesFinca(primerFincaCard);

    // --- Clonar Fincas ---
    const btnAgregarFinca = document.getElementById('btn-agregar-finca');
    const fincasContainer = document.getElementById('fincas-container');

    btnAgregarFinca.addEventListener('click', () => {
        const nuevaFinca = primerFincaCard.cloneNode(true);
        nuevaFinca.querySelectorAll('input').forEach(input => {
            input.value = '';
        });

        const selectEstado = nuevaFinca.querySelector('.select-estado');
        const selectMunicipio = nuevaFinca.querySelector('.select-municipio');
        const selectParroquia = nuevaFinca.querySelector('.select-parroquia');
        
        selectEstado.value = '';
        selectMunicipio.innerHTML = '<option value="">Seleccione Municipio...</option>';
        selectParroquia.innerHTML = '<option value="">Seleccione Parroquia...</option>';
        selectMunicipio.disabled = true;
        selectParroquia.disabled = true;

        const btnEliminar = document.createElement('span');
        btnEliminar.className = 'remove-finca-btn';
        btnEliminar.textContent = '✕ Eliminar Predio';
        btnEliminar.addEventListener('click', () => {
            nuevaFinca.remove();
        });
        nuevaFinca.appendChild(btnEliminar);

        fincasContainer.appendChild(nuevaFinca);
        inicializarUbicacionesFinca(nuevaFinca);
    });

    // --- Envío del Formulario ---
    const form = document.getElementById('form-registro');
    const inputOculto = document.getElementById('input_archivo_oculto');
    const inputExterno = document.getElementById('input_archivo_externo');
    const inputSimilarityHash = document.getElementById('input_similarity_hash');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const normC = normalizarCedulaJS(inputCedula.value);
        const normT = normalizarTelefonoJS(inputTelefono.value);
        if (!normC || !normT) {
            alert('Por favor, corrija los datos antes de enviar.');
            return;
        }

        const metodo = document.querySelector('input[name="metodo_marca"]:checked').value;

        if (metodo === 'subir') {
            if (inputExterno.files.length === 0) {
                alert('Selecciona un archivo PNG.');
                return;
            }
            const file = inputExterno.files[0];
            if (file.type !== 'image/png' || file.size > 2 * 1024 * 1024) {
                alert('Archivo inválido (PNG de max 2MB).');
                return;
            }

            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = function() {
                if (this.width > 1500 || this.height > 1500 || this.width < 50 || this.height < 50) {
                    alert('Resolución inválida (50px a 1500px).');
                    return;
                }
                const simHash = computeAHash(img);
                inputSimilarityHash.value = simHash;

                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                inputOculto.files = dataTransfer.files;

                form.submit();
            };
        } else {
            const simHash = computeAHash(canvas);
            inputSimilarityHash.value = simHash;

            const dataURL = canvas.toDataURL('image/png');
            fetch(dataURL)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], "marca.png", { type: "image/png" });
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    inputOculto.files = dataTransfer.files;

                    form.submit();
                });
        }
    });