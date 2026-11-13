# Teclea

Aplicación de mecanografía para el curso de Grabación de datos (MF0973_1). Los alumnos practican por niveles, hacen pruebas cronometradas y compiten en un ranking de clase. El profesor da de alta a los alumnos, programa las pruebas, ajusta el baremo y exporta las notas.

Tecnología: Next.js (desplegado en Vercel), base de datos Supabase (PostgreSQL), código en GitHub.

## Puesta en marcha

### 1. Supabase (base de datos)

1. Entra en https://supabase.com y crea un proyecto nuevo. Elige una región europea.
2. Ve a **SQL Editor > New query**, pega el contenido de `supabase/schema.sql` y pulsa **Run**. Si tu base se creó con la primera versión, ejecuta también `supabase/migracion-2.sql`.
3. Ve a **Project Settings > API** (o **API Keys**) y copia dos datos:
   - **Project URL**: algo como `https://abcdxyz.supabase.co`
   - **service_role key** (o la *secret key* `sb_secret_...` en los proyectos nuevos). Esta clave es secreta: solo va en Vercel, nunca en el código.

### 2. GitHub (código)

1. Crea un repositorio **privado** llamado `teclea`.
2. Sube el contenido de esta carpeta. Desde la terminal, dentro de la carpeta:

```bash
git init
git add .
git commit -m "Teclea: primera versión"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/teclea.git
git push -u origin main
```

También puedes arrastrar los archivos en la web de GitHub (**Add file > Upload files**).

### 3. Vercel (publicación)

1. En https://vercel.com pulsa **Add New > Project** e importa el repositorio `teclea`.
2. En **Environment Variables** añade estas cuatro:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | La Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | La service_role / secret key |
| `SESSION_SECRET` | Una cadena aleatoria de 32 caracteres o más |
| `SETUP_CODE` | Un código que inventes para crear la cuenta de profesor |

Para `SESSION_SECRET` puedes generar una cadena con `openssl rand -base64 48`, o escribir una frase larga sin sentido.

3. Pulsa **Deploy**. En un par de minutos tendrás la URL (por ejemplo `teclea.vercel.app`).

Cada cambio que subas a GitHub se publica solo.

### 4. Primer uso

1. Entra en `https://TU-URL/profesor/acceso`. La primera vez pide el `SETUP_CODE` para crear tu cuenta de profesor. Hazlo nada más publicar: después ya no se pueden crear más cuentas desde ahí.
2. Crea la clase. Se genera un código tipo `GD-7K2M`.
3. En **Alumnos**, pega los nombres completos, uno por línea. Cada alumno recibe usuario y PIN.
4. Pulsa **Imprimir tarjetas** y reparte una a cada alumno.
5. Revisa el **Baremo** antes de la primera prueba.

Los alumnos entran en la página principal con código de clase, usuario y PIN.

## Cómo funciona

### Alumnos

- **Practicar:** 6 niveles y 19 lecciones (fila guía, fila superior, fila inferior, teclado numérico, mayúsculas y tildes, fichas de datos). Una lección se supera completando el texto con al menos un 90 % de precisión, y eso desbloquea la siguiente.
- **Pruebas:** un solo intento, dentro de la franja horaria que marques. El reloj empieza al pulsar "Empezar" y sigue corriendo aunque se recargue la página. Al acabar el tiempo se entrega sola.
- **Ranking:** semanal (mejor marca desde el lunes) y general (media de las 5 mejores marcas). Solo cuentan ejercicios de 50 caracteres o más. Aparece el alias, nunca el nombre real.
- **Perfil:** cada alumno puede cambiar su alias.

### Profesor

- **Alumnos:** alta masiva, PIN visible, nuevo PIN, lecciones superadas, mejor marca de la semana, última conexión y exportación del resumen en CSV.
- **Pruebas:** texto, duración y franja de apertura. Se pueden cerrar antes de tiempo.
- **Resultados:** brutas, errores, precisión, netas y nota por alumno. Botones para validar un intento marcado y para permitir repetir. Exportación en CSV que se abre directamente en Excel.
- **Baremo:** netas para el 5, netas para el 10, precisión mínima y penalización por error. Las notas se recalculan al cambiarlo.

### Puntuación

```
netas/min = (pulsaciones − errores × penalización) / minutos
```

- Por debajo de las netas del 5, la nota sube proporcionalmente de 0 a 5.
- Entre las netas del 5 y las del 10, sube de 5 a 10.
- Si la precisión no llega al mínimo, la nota máxima es 4.

Valores iniciales: 5 desde 120 netas/min, 10 desde 250, precisión mínima 95 %, penalización 5.

### Seguridad y antitrampas

- La base de datos tiene RLS activado sin políticas. Solo el servidor de la app accede a los datos.
- El servidor recalcula siempre la puntuación a partir del texto escrito y del registro de pulsaciones. No se fía de lo que diga el navegador.
- Se marcan como "en revisión", y no puntúan, los intentos con texto pegado, una velocidad imposible o un registro incoherente. El profesor puede validarlos a mano.
- En las pruebas, el tiempo lo controla el servidor desde que el alumno pulsa "Empezar".
- Tras 10 PIN incorrectos la cuenta del alumno se bloquea hasta que el profesor genere un PIN nuevo.
- El PIN se guarda legible para que el profesor pueda reimprimir las tarjetas. Es un acceso de aula, no una contraseña personal.

## Desarrollo en local

```bash
npm install
cp .env.example .env.local   # y rellena los valores
npm run dev
```

Abre http://localhost:3000.

## Estructura

```
app/
  page.tsx                    Acceso de alumnos
  (alumno)/practicar          Niveles y lecciones
  (alumno)/pruebas            Pruebas del alumno
  (alumno)/ranking            Ranking de clase
  (alumno)/perfil             Cambio de alias
  profesor/acceso             Alta y acceso del profesor
  profesor/(panel)            Panel del profesor
  profesor/clase/[id]/csv     Exportación CSV
  actions/                    Acciones de servidor (alumno y profesor)
components/                   Ejercicio de tecleo, teclado, formularios
lib/                          Base de datos, sesiones, puntuación, lecciones, ranking
supabase/schema.sql           Esquema de la base de datos
```

Las lecciones se editan en `lib/lessons.ts`.

## Próxima fase

Carreras en directo: salas con texto común, cuenta atrás y barras de avance en tiempo real con Supabase Realtime. La tabla `attempts` ya admite el modo `carrera`.
