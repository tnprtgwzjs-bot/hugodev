# Gestor de Cuadrantes y Facturación (Vigilantes)

Proyecto demo con frontend en HTML/CSS/JS y backend Node.js (Express) para autenticación y persistencia básica.

Pasos para ejecutar:

```bash
cd c:\Users\hugo\Desktop\web_ccp_ia
npm install
npm start
# Abrir http://localhost:3000
```

Notas:
- La clave JWT por defecto está en la variable de entorno `JWT_SECRET`. Cámbiala en producción.
- Registro de usuario disponible en la UI. Para seguridad real, añade validación y bloqueo de registro si procede.

Administración y registro:
- Al iniciar el servidor por primera vez se crea un usuario `admin` por defecto y se escriben sus credenciales en `admin_credentials.txt` en la raíz del proyecto.
- El endpoint de registro está deshabilitado por defecto. Para permitir registro público establece la variable de entorno `ALLOW_REGISTRATION=true` antes de iniciar el servidor.
- Para fijar la contraseña del admin antes del arranque, exporta `ADMIN_PWD` con la contraseña deseada.

