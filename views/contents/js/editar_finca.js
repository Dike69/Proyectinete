const selectEstado = document.getElementById('select-estado');
    const selectMunicipio = document.getElementById('select-municipio');
    const selectParroquia = document.getElementById('select-parroquia');

    const formFinca = document.getElementById("form-finca");
    const selectedEstadoId = parseInt(formFinca.dataset.estadoId);
    const selectedMunicipioId = parseInt(formFinca.dataset.municipioId);
    const selectedParroquiaId = parseInt(formFinca.dataset.parroquiaId);

    // Cargar Estados al iniciar y pre-seleccionar
    fetch('/productores/api/estados')
        .then(res => res.json())
        .then(estados => {
            estados.forEach(est => {
                const opt = document.createElement('option');
                opt.value = est.id;
                opt.textContent = est.nombre;
                if (est.id === selectedEstadoId) opt.selected = true;
                selectEstado.appendChild(opt);
            });
            cargarMunicipios(selectedEstadoId, selectedMunicipioId);
        });

    function cargarMunicipios(idEstado, selectId = null) {
        selectMunicipio.innerHTML = '<option value="">Seleccione un Municipio...</option>';
        selectParroquia.innerHTML = '<option value="">Seleccione una Parroquia...</option>';
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
                    if (selectId && mun.id === selectId) opt.selected = true;
                    selectMunicipio.appendChild(opt);
                });
                selectMunicipio.disabled = false;
                if (selectId) {
                    cargarParroquias(selectId, selectedParroquiaId);
                }
            });
    }

    function cargarParroquias(idMunicipio, selectId = null) {
        selectParroquia.innerHTML = '<option value="">Seleccione una Parroquia...</option>';
        selectParroquia.disabled = true;

        if (!idMunicipio) return;

        fetch(`/productores/api/parroquias?id_municipio=${idMunicipio}`)
            .then(res => res.json())
            .then(parroquias => {
                parroquias.forEach(parq => {
                    const opt = document.createElement('option');
                    opt.value = parq.id;
                    opt.textContent = parq.nombre;
                    if (selectId && parq.id === selectId) opt.selected = true;
                    selectParroquia.appendChild(opt);
                });
                selectParroquia.disabled = false;
            });
    }

    selectEstado.addEventListener('change', () => {
        cargarMunicipios(selectEstado.value);
    });

    selectMunicipio.addEventListener('change', () => {
        cargarParroquias(selectMunicipio.value);
    });