function toggleActivo(id, activoActual) {
            const nuevoEstado = activoActual ? 0 : 1;
            
            fetch(`/productores/toggle-activo/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ activo: nuevoEstado })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    window.location.reload();
                } else {
                    alert('Error al actualizar el estado del productor.');
                }
            })
            .catch(err => {
                console.error(err);
                alert('Ocurrió un error al enviar la solicitud.');
            });
        }