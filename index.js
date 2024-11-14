const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const express = require('express');
const app = express();
const port = 3001;

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

async function listLabels(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.labels.list({
        userId: 'me',
    });
    const labels = res.data.labels;
    if (!labels || labels.length === 0) {
        console.log('No labels found.');
        return;
    }
    console.log('Labels:');
    labels.forEach((label) => {
        console.log(`- ${label.name}:${label.id}`);
    });
}
authorize().then(listLabels).catch(console.error);

app.get("/", async (req, res) => {

    // Get Unreplied messages
    async function getUnrepliedMessages(auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: '-in:chat -from:me -has:userlabels'
        });
        return res.data.messages || [];
    }

    // Send Replies
    async function sendReply(auth, message) {
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From'],
        });

        const subject = res.data.payload.headers.find((header) => header.name == 'Subject').value;
        const from = res.data.payload.headers.find((header) => header.name == 'From').value;

        const replyTo = from.match(/<(.*)>/)[1];
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        const replyBody = `Dear, \n\n we have received your mail and will reply soon. \n\n Regards,\n Narayan Raghuwanshi`

        const rawMessage = [
            `From: me`,
            `To: ${replyTo}`,
            `Subject: ${replySubject}`,
            `In-Reply-To: ${message.id}`,
            `References: ${message.id}`,
            ``,
            replyBody
        ].join('\n');

        const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '-').replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
    }

    /* Create label */
    const LABEL_NAME = 'PENDING';
    async function createLabel(auth) {
        const gmail = google.gmail({ version: 'v1', auth });
        try {
            const res = await gmail.users.labels.create({
                userId: 'me',
                requestBody: {
                    name: LABEL_NAME,
                    labelListVisibility: 'labelShow',
                    messageListVisibility: 'show'
                }
            })
            return res.data.id;
        } catch (err) {
            if (err.code === 409) {
                //label already exist
                const res = await gmail.users.labels.list({
                    userId: 'me'
                })
                const label = res.data.labels.find((label) => label.name === LABEL_NAME);
                return label.id;
            } else {
                throw err;
            }
        }
    }

    /* Add label to the message and move it ot the label folder */
    async function addLabel(auth, message, labelId) {
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.modify({
            id: message.id,
            userId: 'me',
            requestBody: {
                addLabelIds: [labelId],
                removeLabelIds: ['INBOX'],
            },
        });
    }

    async function main() {
        const auth = await authorize()
        const labelId = await createLabel(auth);
        console.log(`LABEL ID: ${labelId}`)
        setInterval(async () => {
            const messages = await getUnrepliedMessages(auth);
            console.log(`UNREPLIED MESSAGES: ${messages.length}`);
            for (let message of messages) {
                await sendReply(auth, message);
                console.log(`REPLIED TO: ${message.id}`)
                await addLabel(auth, message, labelId)
                console.log(`ADDED LABEL TO: ${message.id}`)
            }
        }, Math.floor(Math.random() * (10 - 5 + 1) + 5) * 1000);
    }

    main().catch(console.error);
    res.send("Success !!!!");
})

app.listen(port, () => {
    console.log(`Listening at: http://localhost:${port}`);
})
