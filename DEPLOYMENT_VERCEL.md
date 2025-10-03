# 🚀 Guía de Deployment en Vercel

Esta guía te ayudará a deployar tu aplicación **GastoGrupal** en Vercel.

## 📋 Requisitos Previos

- Cuenta en Vercel (https://vercel.com)
- Cuenta en GitHub con el repositorio de GastoGrupal
- Base de datos Supabase configurada

## 🔧 Paso 1: Preparar el Proyecto

Los siguientes archivos ya están configurados:
- ✅ `vercel.json` - Configuración de Vercel
- ✅ `api/index.js` - Punto de entrada para serverless functions
- ✅ Scripts en `package.json`

## 🌐 Paso 2: Conectar con Vercel

### Opción A: Desde el Dashboard de Vercel

1. Ve a https://vercel.com/dashboard
2. Click en **"Add New Project"**
3. Selecciona **"Import Git Repository"**
4. Autoriza Vercel para acceder a tu repositorio de GitHub
5. Selecciona el repositorio **GastoGrupal**

### Opción B: Desde la CLI de Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deployar
vercel
```

## ⚙️ Paso 3: Configurar Variables de Entorno

En el dashboard de Vercel, ve a **Settings → Environment Variables** y agrega:

### Variables Requeridas:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `SUPABASE_URL` | `https://zztyrfmtqwzttbhievro.supabase.co` | URL de tu proyecto Supabase |
| `SUPABASE_ANON_KEY` | `tu_clave_anon_key_aquí` | Clave anónima de Supabase |
| `NODE_ENV` | `production` | Ambiente de producción |

### ⚠️ Importante:
- Marca estas variables para **Production**, **Preview** y **Development**
- La `SUPABASE_ANON_KEY` la encuentras en: Supabase Dashboard → Settings → API

## 🏗️ Paso 4: Configurar el Build

Vercel debería detectar automáticamente la configuración desde `vercel.json`, pero verifica:

- **Framework Preset**: None
- **Build Command**: `npm run build`
- **Output Directory**: `dist/public`
- **Install Command**: `npm install`

## 🚀 Paso 5: Deploy

1. Click en **"Deploy"**
2. Espera a que termine el build (2-3 minutos)
3. Una vez completado, verás la URL de tu aplicación

## ✅ Verificación

Después del deployment, verifica:

1. **Frontend**: Abre la URL de Vercel, deberías ver tu aplicación React
2. **API**: Prueba `https://tu-app.vercel.app/api/users`
3. **Supabase**: Verifica que los datos se muestren correctamente

## 🐛 Solución de Problemas

### Error: "Cannot read properties of undefined"
- Verifica que las variables de entorno estén configuradas correctamente
- Asegúrate de que la tabla `payments` exista en Supabase

### Error: "500 Internal Server Error"
- Revisa los logs en Vercel Dashboard → Deployments → (tu deployment) → Functions
- Verifica que las credenciales de Supabase sean correctas

### La aplicación muestra código fuente
- Asegúrate de que `vercel.json` esté en la raíz del proyecto
- Verifica que el build se haya completado correctamente

## 🔄 Re-deploy

Para actualizar tu aplicación:

1. Haz push a tu repositorio de GitHub
2. Vercel automáticamente detectará los cambios y re-deployará
3. O usa: `vercel --prod` desde la CLI

## 📝 Comandos Útiles

```bash
# Deploy a producción
vercel --prod

# Ver logs
vercel logs

# Ver información del proyecto
vercel inspect

# Deshacer último deployment
vercel rollback
```

## 🎯 URLs Importantes

Después del deployment, tendrás:
- **Aplicación**: `https://tu-app.vercel.app`
- **API**: `https://tu-app.vercel.app/api/*`
- **Dashboard**: `https://vercel.com/dashboard`

---

## ✨ ¡Listo!

Tu aplicación **GastoGrupal** ahora está en producción y accesible desde cualquier lugar.

Si tienes problemas, revisa:
- Logs de Vercel
- Console del navegador (F12)
- Variables de entorno
