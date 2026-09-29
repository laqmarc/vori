# Vori · Piano tàctil

Piano web en català per a mòbil, tauleta i ordinador. No necessita instal·lar biblioteques ni registrar-se en cap servei d'àudio.

## Com començar

Obre la web i prem **Activa el so**. Espera que indiqui **A punt per tocar** i toca les tecles. La primera activació carrega aproximadament 850 kB de mostres.

- Sis sons: piano de cua, piano suau, elèctric, orgue, sintetitzador i ambient.
- Acords multitàctils i lliscament entre notes.
- Filtre passabaix, passaalt o passabanda, amb freqüència i ressonància; també es pot desactivar.
- Reverberació, eco, atac, durada en deixar anar, pedal i volum.
- Arrossega els controls rodons amunt o avall, o utilitza els lliscadors.
- Una octava visible en mòbil vertical i dues en pantalles amples. Canvia el registre amb els botons d'octava.
- Teclat d'ordinador: `A W S E D F T G Y H U J K O L P ;`. `Espai` activa el pedal mentre el mantens premut; `Esc` atura el so.
- **Silenci** talla totes les notes i els efectes. Canviar de so, canviar d'octava o sortir de la pàgina també atura les notes.

Per tocar en mòbil, la vista horitzontal deixa més espai al teclat. El mode de pantalla completa es mostra si el navegador el permet. Si no sona, comprova el volum multimèdia i el mode silenciós.

## Executar el projecte localment

Amb Node.js instal·lat, des de la carpeta del projecte:

```sh
node scripts/serve.mjs
```

Obre `http://127.0.0.1:4175/`. Cal servir els fitxers per HTTP; no obris `index.html` directament com a fitxer. Per allotjar-lo en un altre servidor web, publica el contingut de `dist/` mantenint-ne les carpetes.

## Estructura

- `dist/index.html`: interfície i ajuda.
- `dist/style.css`: disseny adaptable i teclat.
- `dist/app.js`: interacció tàctil, dreceres i controls.
- `dist/audio.js`: mostres, síntesi, polifonia i efectes amb Web Audio.
- `dist/samples/`: mostres de piano i llicència.
- `scripts/serve.mjs`: servidor local sense dependències.

Tot l'àudio es processa al dispositiu. No s'utilitza micròfon, no s'envien interpretacions i no es guarden dades personals. La polifonia es limita a 24 veus, comptant les cues de notes, per acotar el consum en mòbil. Si les mostres no es poden carregar, hi ha un piano sintetitzat de reserva amb avís visible.

## Crèdits

Mostres de **Salamander Grand Piano**, d'Alexander Holm, amb llicència [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/). Fitxers MP3 distribuïts per [Tone.js](https://github.com/Tonejs/audio/tree/master/salamander). S'utilitza una selecció de 13 mostres sense modificar els fitxers; es transposen i es filtren durant la reproducció. La llicència s'inclou a `dist/samples/LICENSE.txt`. La resta de timbres són sintetitzats.

## Verificació

Consulta `VALIDACIO.md`. Les proves de navegador i l'emulació tàctil no substitueixen les proves en un iPhone, Android o iPad físic.
