/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import axios from "axios";

setGlobalOptions({ maxInstances: 10 });

// --- Utils ---
const getTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const generatePassword = (shortcode: string, passkey: string, timestamp: string): string => {
  const buffer = Buffer.from(`${shortcode}${passkey}${timestamp}`);
  return buffer.toString('base64');
};

// --- Credentials ---
const BUSINESS_SHORT_CODE = process.env.MPESA_SHORTCODE || "174379";
const PASSKEY = process.env.MPESA_PASSKEY || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || "bsAnhvj1VJDYoruubasQaBQdrhbmfFESeObTeGoFkexM34XY";
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || "ZBWeuZHq6R7GKgbiBnYpFQ9eGXK1k9jQusHmzD50zJ891r67O364KP9Nnn0QaUhY";

const isProduction = process.env.NODE_ENV === "production";
const DARASA_AUTH_URL = isProduction
  ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
  : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
const DARASA_STK_PUSH_URL = isProduction
  ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
  : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

// --- Functions ---
const getAuthToken = async (): Promise<string> => {
    const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
    try {
        const response = await axios.get(DARASA_AUTH_URL, {
            headers: { "Authorization": `Basic ${credentials}` },
        });
        return response.data.access_token;
    } catch (error) {
        logger.error("Failed to get M-Pesa auth token:", error);
        throw new Error("Could not authenticate with M-Pesa.");
    }
};

export const initiateMpesaPayment = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }

    const { amount, phone } = req.body;

    if (!amount || !phone) {
        res.status(400).json({ success: false, error: "Missing 'amount' or 'phone' in request body." });
        return;
    }

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount < 1) {
        res.status(400).json({ success: false, error: "Invalid 'amount'." });
        return;
    }
    
    if (!/^254\d{9}$/.test(phone)) {
        res.status(400).json({ success: false, error: "Invalid 'phone' number format. Use 254XXXXXXXXX." });
        return;
    }

    try {
        const token = await getAuthToken();
        const timestamp = getTimestamp();
        const password = generatePassword(BUSINESS_SHORT_CODE, PASSKEY, timestamp);

        const payload = {
            BusinessShortCode: BUSINESS_SHORT_CODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline", 
            Amount: parsedAmount,
            PartyA: phone, 
            PartyB: BUSINESS_SHORT_CODE, 
            PhoneNumber: phone, 
            CallBackURL: `https://us-central1-attendance-logging-syste-5540c.cloudfunctions.net/mpesaCallback`, 
            AccountReference: "NFC-Payment", 
            TransactionDesc: "Payment for NFC service",
        };

        const response = await axios.post(DARASA_STK_PUSH_URL, payload, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        logger.info("M-Pesa STK Push initiated successfully:", response.data);
        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        logger.error("Error initiating M-Pesa payment:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        res.status(500).json({ success: false, error: errorMessage });
    }
});

export const mpesaCallback = onRequest({ cors: true }, (req, res) => {
    logger.info("Received M-Pesa callback:", req.body);
    
    if (!req.body || !req.body.Body || !req.body.Body.stkCallback) {
        res.status(400).send("Invalid callback payload");
        return;
    }

    const callbackData = req.body.Body.stkCallback;

    if (callbackData.ResultCode === 0) {
        logger.info("Payment successful:", callbackData.CallbackMetadata);
    } else {
        logger.error("Payment failed:", callbackData.ResultDesc);
    }

    res.status(200).json({
        "ResultCode": 0,
        "ResultDesc": "Accepted"
    });
});
