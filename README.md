# React + Vite

## Bestellsystem

Die Anwendung enthält ein eigenes Bestellsystem und den geschützten Bereich
`/system/admin`. Der Node-Prozess (`npm start`) muss dauerhaft laufen; ein rein
statisches Hosting reicht für Bestellungen und Administration nicht aus.

Vor dem ersten Produktionsstart:

1. `.env.example` als Vorlage für die Server-Umgebung verwenden.
2. `APP_MASTER_KEY` mit mindestens 32 zufälligen Zeichen setzen und sicher sichern.
3. `ADMIN_EMAIL` und ein einzigartiges `ADMIN_PASSWORD` mit mindestens 14 Zeichen setzen.
4. `PUBLIC_URL=https://graffitismash.de` setzen und `NODE_ENV=production` außerhalb
   der `.env` im Hosting beziehungsweise Prozessmanager konfigurieren.
5. Den Ordner aus `DATA_DIR` persistent sichern und nur für den Serverprozess lesbar machen.

SMTP und Telegram werden anschließend unter `/system/admin` konfiguriert. Secrets
werden verschlüsselt in SQLite gespeichert. Die `.env`-Datei und Datenbank dürfen
nicht in Git eingecheckt oder über den Webserver ausgeliefert werden.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
