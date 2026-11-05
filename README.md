# Le mie abitudini

Habit tracker personale, pensato per il telefono e in italiano.

## Cosa fa

- **🎯 Le 3 non negoziabili**: al mattino scrivi le 3 cose che devi assolutamente fare; la sera vedi il bilancio (dalle 19 in poi o nei giorni passati).
- **✅ Abitudini**: aggiungi le tue abitudini, spuntale ogni giorno, guarda la streak 🔥 e la barra degli ultimi 7 giorni.
- **📚 Studio**: registra quanto hai studiato (pulsanti rapidi, minuti a mano o cronometro) e vedi se hai raggiunto l'obiettivo giornaliero.
- **📈 Progressi**: streak e record, grafico dello studio, calendario delle abitudini, storico delle non negoziabili.
- Puoi tornare ai giorni precedenti con le frecce in alto per spuntare quello che avevi dimenticato.

## Dove sono i dati

Tutto resta **sul tuo dispositivo** (nel browser). Nessun account, nessun server.
Da *Impostazioni → Backup* puoi esportare e importare un file di backup.

## Come provarla sul computer

```bash
python3 -m http.server 8000
```

Poi apri http://localhost:8000

## Come usarla sul telefono (GitHub Pages)

1. Su GitHub: *Settings → Pages*.
2. In *Source* scegli **Deploy from a branch**, poi il branch `main` e la cartella `/ (root)`.
3. Dopo un minuto l'app è online su `https://<tuo-utente>.github.io/prova/`.
4. Aprila dal telefono e aggiungila alla schermata Home (iPhone: Condividi → «Aggiungi alla schermata Home»).

## File

| File | A cosa serve |
| --- | --- |
| `index.html` | Struttura della pagina |
| `styles.css` | Grafica (con tema chiaro e scuro automatico) |
| `app.js` | Tutta la logica: dati, streak, studio, priorità |
| `sw.js` | Permette di usare l'app offline |
| `manifest.webmanifest` | Rende l'app installabile sul telefono |
