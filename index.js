// index.js
const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const admin = require("firebase-admin");

// =======================
// Environment Variables
// =======================
const PORT = process.env.PORT || 3000;

const FIREBASE_CREDENTIALS_BASE64 = process.env.FIREBASE_CREDENTIALS_BASE64;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

const GOOGLE_SHEETS_CREDENTIALS_BASE64 = process.env.GOOGLE_SHEETS_CREDENTIALS_BASE64;
const SHEET_ID = process.env.SHEET_ID;

const SMTP_SERVER = process.env.SMTP_SERVER;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_TO = process.env.EMAIL_TO;

// =======================
// Initialize Firebase
// =======================
const firebaseCredentials = JSON.parse(Buffer.from(FIREBASE_CREDENTIALS_BASE64, "base64").toString("utf8"));

admin.initializeApp({
  credential: admin.credential.cert(firebaseCredentials),
  databaseURL: FIREBASE_DB_URL,
});

const db = admin.database();

// =======================
// Initialize Google Sheet
// =======================
const sheetCredentials = JSON.parse(Buffer.from(GOOGLE_SHEETS_CREDENTIALS_BASE64, "base64").toString("utf8"));
const doc = new GoogleSpreadsheet(SHEET_ID);

// =======================
// Initialize Nodemailer
// =======================
const transporter = nodemailer.createTransport({
  host: SMTP_SERVER,
  port: Number(SMTP_PORT),
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// =======================
// Express App Setup
// =======================
const app = express();
app.use(bodyParser.json());

// =======================
// POST Endpoint for Form Data
// =======================
app.post("/submit", async (req, res) => {
  try {
    const data = req.body; // Expecting JSON {name, email, message} or any fields

    // 1️⃣ Push to Firebase
    const firebaseRef = db.ref("form_submissions");
    await firebaseRef.push(data);

    // 2️⃣ Push to Google Sheet
    await doc.useServiceAccountAuth(sheetCredentials);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // First sheet
    await sheet.addRow(data);

    // 3️⃣ Send Email via Amazon SES
    const mailOptions = {
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject: `New Form Submission`,
      text: JSON.stringify(data, null, 2),
    };
    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "Data submitted to Firebase, Sheet & Email!" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// Start Server
// =======================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
