# TODO - Eventos editables y persistencia

- [ ] Añadir endpoints en `server.js`:
  - [ ] `PUT /api/eventos/:id` para editar turno
  - [ ] `DELETE /api/eventos/:id` para eliminar turno
- [ ] Actualizar `app.js` (Eventos):
  - [ ] Cargar `eventosStore` desde `GET /api/eventos` al entrar en la página
  - [ ] Hacer modal “Nuevo turno / Editar turno”:
    - [ ] Si se abre desde un evento existente, cargar campos y conservar id
    - [ ] Guardar con POST si no hay id, o PUT si hay id
    - [ ] Añadir botón para borrar (opcional pero recomendado)
  - [ ] Hacer edición desde el calendario:
    - [ ] `eventClick` abre el modal en modo edición
    - [ ] Mantener `dateClick` para modo creación
  - [ ] Sincronizar UI tras cualquier cambio:
    - [ ] refrescar lista `#eventos-list`
    - [ ] refrescar calendario
- [ ] Probar rápido:
  - [ ] Crear turno desde un día y verificar persistencia (BD)
  - [ ] Editar turno desde click evento y verificar persistencia
  - [ ] (Si se implementa) borrar turno y verificar persistencia

