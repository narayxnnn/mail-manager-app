# Mail Manager
A Node.js server is implemented to monitor incoming unread emails, automatically generating and dispatching replies, and subsequently categorizing them by assigning appropriate labels.

## Features
- Access unread emails
- Reply new emails
- Create Label
- Assign Label to an email

## Getting Started

```bash
git clone https://github.com/narayan-raghuwanshi/mail-manager.git
```
- Provide Gmail API access through [Google Cloud Console](https://developers.google.com/gmail/api/quickstart/nodejs) and download the credentials from it.
- Now create a file named `credentials.json` in `root` folder and paste the downloaded credentials in `credentials.json`.
```bash
npm install
```
```bash
node index.js
```
Initially it will ask for authorization for first time, then just visit the [http://localhost:3001](http://localhost:3001)
