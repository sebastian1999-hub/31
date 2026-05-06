# Juego del 31 (Online)

Web app con login en Supabase y salas online por codigo.

## Incluye
- Login con email/password (Supabase Auth)
- Flujo online (sin localStorage):
  - Crear sala
  - Unirse a sala por codigo
  - Salir de sala
- Partida 31 con reglas que definiste:
  - Robo de mazo o descarte
  - Descarte obligatorio (mano de 3)
  - Cierre desde segundo turno
  - 31 exactos con cierre automatico
  - Penalizacion minima (+1), empate minimo (+1), cierre fallido (+2)
  - Eliminacion al llegar a 10

## Archivos clave
- index.html
- styles.css
- app.js
- game31-rooms.sql

## Ejecutar
```bash
cd /c/Users/sebaspc/Desktop/31
python -m http.server 5173
```

Abre:
- http://localhost:5173

## SQL necesario en Supabase
Ejecuta game31-rooms.sql en SQL Editor antes de usar la app.
Ese script crea tablas nuevas de salas online con RLS y no toca tablas existentes.
