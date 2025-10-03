# Instrucciones de Migración a Supabase

## ⚠️ IMPORTANTE: Pasos para completar la migración

### 1. Ejecutar SQL en Supabase

Antes de iniciar la aplicación, debes crear las tablas en tu base de datos Supabase:

1. Ve a tu proyecto de Supabase: https://zztyrfmtqwzttbhievro.supabase.co
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega **todo el contenido** del archivo `supabase_migration.sql`
5. Ejecuta la query (botón Run o Ctrl/Cmd + Enter)

Esto creará:
- Las 3 tablas necesarias (`users`, `expenses`, `expense_participants`)
- Los índices para optimizar las consultas
- Las políticas de seguridad (RLS)
- Los 4 usuarios predefinidos

### 2. Verificar la Migración

Para verificar que las tablas se crearon correctamente:

1. Ve a **Table Editor** en Supabase
2. Deberías ver las tablas:
   - `users` (con 4 usuarios predefinidos)
   - `expenses`
   - `expense_participants`

### 3. Configurar Variables de Entorno (Ya completado)

El archivo `.env` ya está creado con tus credenciales:
```
SUPABASE_URL=https://zztyrfmtqwzttbhievro.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

### 4. Iniciar la Aplicación

Una vez ejecutado el SQL, puedes iniciar la aplicación:

```bash
npm run dev
```

La aplicación debería:
- Conectarse a Supabase correctamente
- Mostrar los 4 usuarios predefinidos
- Permitir crear gastos
- Calcular deudas automáticamente

## 🔧 Cambios Realizados

### Backend
- ✅ Instalado `@supabase/supabase-js`
- ✅ Removido `@neondatabase/serverless`
- ✅ Reescrito `server/storage.ts` con API nativa de Supabase
- ✅ Agregados nuevos endpoints en `server/routes.ts`:
  - `GET /api/expenses/all` - Obtener todos los gastos con filtros
  - `PUT /api/expenses/:id` - Actualizar gasto
  - `DELETE /api/expenses/:id` - Eliminar gasto
  - `POST /api/users` - Crear usuario
  - `PUT /api/users/:id` - Actualizar usuario
  - `PATCH /api/users/:id/toggle` - Activar/desactivar usuario
  - `GET /api/debts/simplified` - Obtener deudas simplificadas

### Base de Datos
- ✅ Schema actualizado con campo `active` en usuarios
- ✅ SQL de migración creado con RLS habilitado

## 📝 Próximos Pasos

Una vez la migración esté completa y funcionando:
1. Implementar división porcentual y exacta en formulario
2. Agregar botones de editar/eliminar gastos
3. Crear componente de gestión de usuarios
4. Crear página de historial
5. Implementar modal de simplificación de deudas

## 🐛 Troubleshooting

Si encuentras errores:

1. **Error de conexión a Supabase**: Verifica que las credenciales en `.env` sean correctas
2. **Error de tablas no encontradas**: Asegúrate de haber ejecutado el SQL completo
3. **Error de RLS**: Verifica que las políticas se hayan creado correctamente en Supabase

## 📞 Contacto

Si necesitas ayuda, revisa los logs del servidor y de la consola del navegador.
