# Scripts de Utilidad

Scripts auxiliares para desarrollo, testing y despliegue del proyecto Bartolomed.

## 📋 Scripts Disponibles

### `verify-backend-build.sh`

**Propósito:** Verificar que el Dockerfile del backend construye correctamente ANTES de hacer deploy a Dokploy.

**Cuándo usarlo:**

- ✅ Antes de hacer push a producción
- ✅ Después de cambios en el backend que afecten la compilación
- ✅ Cuando hay errores de "Cannot find module" en Dokploy
- ✅ Para debug local de problemas de Docker build

**Cómo usarlo:**

```bash
# Desde la raíz del proyecto
./scripts/verify-backend-build.sh
```

**Qué hace:**

1. Construye la imagen Docker del backend localmente
2. Verifica que `/app/dist/main.js` exista en la imagen
3. Lista los archivos compilados en `/app/dist`
4. Inicia un contenedor de prueba por 5 segundos
5. Muestra logs y verifica que el proceso arranca
6. Limpia recursos temporales

**Salida esperada:**

```
✅ BUILD EXITOSO
✅ dist/main.js encontrado
✅ Contenedor está corriendo
✅ VERIFICACIÓN COMPLETADA
```

**Si falla:**

- Revisa los logs de construcción para errores TypeScript
- Verifica que todas las dependencias estén en package.json
- Confirma que tsconfig.json sea válido
- Consulta `docs/TROUBLESHOOTING-DOKPLOY.md`

### `health-check.sh`

**Propósito:** Verificar que los servicios estén corriendo correctamente.

**Uso:**

```bash
./scripts/health-check.sh
```

### `verify-seeder.sh`

**Propósito:** Verificar que los seeders funcionen correctamente.

**Uso:**

```bash
./scripts/verify-seeder.sh
```

## 🔧 Troubleshooting

Si algún script falla:

1. **Permisos:** Asegúrate de que el script tenga permisos de ejecución:

   ```bash
   chmod +x scripts/*.sh
   ```

2. **Docker:** Verifica que Docker esté corriendo:

   ```bash
   docker ps
   ```

3. **Dependencias:** Confirma que las dependencias estén instaladas:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

## 📚 Documentación Relacionada

- [Troubleshooting Dokploy](../docs/TROUBLESHOOTING-DOKPLOY.md)
- [Godmode Setup](../GODMODE-SETUP.md)
- [Deploy Dokploy](../docs/DEPLOY-DOKPLOY-NET-INTERNA.md)

---

**Última actualización:** 11 de noviembre de 2025
