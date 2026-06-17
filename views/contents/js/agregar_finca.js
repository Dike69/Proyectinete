const selectEstado = document.getElementById('select-estado');
    const selectMunicipio = document.getElementById('select-municipio');
    const selectParroquia = document.getElementById('select-parroquia');

    // Cargar Estados al iniciar
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

    // Escuchar cambios de Estado para cargar Municipios
    selectEstado.addEventListener('change', () => {
        const idEstado = selectEstado.value;
        
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
                    selectMunicipio.appendChild(opt);
                });
                selectMunicipio.disabled = false;
            });
    });

    // Escuchar cambios de Municipio para cargar Parroquias
    selectMunicipio.addEventListener('change', () => {
        const idMunicipio = selectMunicipio.value;

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
                    selectParroquia.appendChild(opt);
                });
                selectParroquia.disabled = false;
            });
    });