# Portfolio Mentor — Project Brief (v1 / MVP)

## Qué es
Web app de una sola página donde un diseñador de producto/UX/UI/gráfico sube capturas de su portfolio (o pega la URL) y recibe una evaluación estilo "¿pasarías el filtro de 10 segundos de un reclutador senior de Google/Microsoft/Anthropic?", generada llamando a Claude con el rubric definido en `SKILL.md`.

## A quién sirve
Diseñadores (product, UX/UI, gráfico) buscando trabajo, sobre todo quienes van a compartir el resultado en LinkedIn. No es una herramienta genérica para "cualquier profesional".

## Flujo de usuario (v1)
1. El usuario selecciona su nivel de seniority objetivo: junior / mid / senior / staff-principal.
2. Sube de 1 a 5 capturas de pantalla de su portfolio (home + case studies) **o** pega la URL.
3. La app llama a Claude usando el rubric de `SKILL.md` como contexto de evaluación.
4. Se muestra la **tarjeta resumen** (Capa 1 del rubric): nota global en semáforo + nota por categoría + titular compartible.
5. (Fuera de v1, pero dejar el hueco visual): botón "Desbloquear informe detallado" que en el futuro dará acceso a la Capa 2 (mentor conversacional de pago).

## Explícitamente FUERA de alcance en v1 — no construir esto todavía
- Generador de CV.
- Tracker/CRM de aplicaciones a empleo.
- Aplicación automática en LinkedIn/Indeed (scraping).
- Cuentas de usuario, login, base de datos.
- Cobro/pagos — el botón de "informe detallado" puede existir visualmente pero no tiene que funcionar todavía.
- Modo Blueprint (usuario sin portfolio) — se añade en una segunda fase, una vez validado el modo Auditoría.

## Criterio de éxito del v1
No es "que quede bonito" — es que sea suficiente para: (a) que Miguel pueda correrlo con portfolios reales de gente que responda a un post de LinkedIn, y (b) que el resultado sea lo bastante creíble y compartible como para generar señal real de interés.

## Notas técnicas (a decidir por Claude Code, no prescriptivo)
- Necesita capacidad de visión (analizar capturas de pantalla, no solo texto).
- Sin necesidad de infraestructura pesada: nada de cuentas ni base de datos en v1. Un simple registro de envíos (aunque sea un archivo o una hoja de cálculo) es suficiente si Miguel quiere ver quién lo ha probado.
- Priorizar velocidad de desarrollo y algo desplegable fácilmente (ej. Vercel) sobre arquitectura sofisticada — esto es un experimento de validación, no el producto final.

## Referencia
El criterio de evaluación completo (rubric, tono, modos) vive en `SKILL.md`, en la misma carpeta del proyecto. Este documento describe la aplicación; `SKILL.md` describe el criterio del mentor.
