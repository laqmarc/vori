# Verificació · 29 de setembre de 2026

Proves executades sobre el projecte final en Google Chrome amb Playwright, en mode sense finestra. **28 comprovacions principals correctes, sense errors d'execució al navegador**, més les comprovacions addicionals de cicle de vida i controls.

- Càrrega i descodificació de les 13 mostres MP3.
- Reproducció dels sis sons mitjançant OfflineAudioContext: tots produeixen senyal finit, no silenciós i sense saturació en la prova d'una nota.
- Comparació del sintetitzador amb el filtre obert i tancat: la prova detecta una disminució clara de l'energia.
- Comparació de so sec i amb efectes: l'eco i la reverberació produeixen una cua d'àudio mesurable.
- Acord de tres notes amb teclat d'ordinador, alliberament, pedal i canvi de so mentre una tecla està premuda.
- Tres contactes tàctils simultanis, lliscament entre notes i cancel·lació tàctil, mitjançant esdeveniments tàctils del navegador.
- Desactivació del filtre, restauració del so i absència d'interferències de les dreceres amb els controls.
- Arrossegament del control rodó: actualitza el mateix paràmetre que el lliscador.
- Ràfega de 80 notes amb durada màxima: el nombre total de veus, incloses les cues, queda acotat a 24.
- Aturada d'emergència: cap veu retinguda i sortida silenciosa després de l'aturada.

Mides inspeccionades, totes sense desbordament horitzontal de la pàgina: 1366 × 960, 390 × 844, 320 × 740, 834 × 1112 i 844 × 390. Inspecció visual de captures de mòbil, ordinador i vista horitzontal. En pantalles verticals petites cal desplaçar la pàgina per veure tots els controls.

L'exposició opcional d'eines WebMCP no està disponible de forma nativa en el navegador de prova. La integració s'ha verificat amb un registre simulat: registre de les dues eines, configuració vàlida, lectura de l'estat i rebuig d'entrades invàlides sense modificar-lo. Això no confirma compatibilitat WebMCP nativa.

No s'ha fet una prova en dispositius físics iPhone, iPad o Android ni una mesura de latència amb maquinari. Les proves d'àudio són mesures de senyal; no substitueixen una valoració auditiva en els altaveus o auriculars de cada dispositiu.
