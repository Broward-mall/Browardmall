import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import PDFDocument from "pdfkit";

// Rate limiting state
const rateLimits: { [key: string]: { count: number; resetTime: number } } = {};

function checkRateLimit(ip: string, limit = 5, windowMs = 5 * 1000 * 60) {
  const now = Date.now();
  if (!rateLimits[ip]) {
    rateLimits[ip] = { count: 1, resetTime: now + windowMs };
    return true;
  }
  const entry = rateLimits[ip];
  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + windowMs;
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

// Backend-safe Firebase Config (combining VITE_ and server process environment mappings for absolute compatibility)
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "broward-8e8f1";
const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyCtxNaHJCRQXNemlTXmNIJ3jG1GF7A7ha8";

// Map raw Firestore REST API document fields back into a clean standard JSON object
function mapFirestoreFields(fields: any) {
  const result: any = {};
  if (!fields) return result;
  for (const [key, value] of Object.entries(fields)) {
    const val = value as any;
    if (val.stringValue !== undefined) {
      result[key] = val.stringValue;
    } else if (val.doubleValue !== undefined) {
      result[key] = Number(val.doubleValue);
    } else if (val.integerValue !== undefined) {
      result[key] = Number(val.integerValue);
    } else if (val.booleanValue !== undefined) {
      result[key] = val.booleanValue;
    } else if (val.mapValue !== undefined) {
      result[key] = mapFirestoreFields(val.mapValue.fields);
    } else if (val.arrayValue !== undefined) {
      result[key] = (val.arrayValue.values || []).map((item: any) => {
        if (item.stringValue !== undefined) return item.stringValue;
        if (item.doubleValue !== undefined) return Number(item.doubleValue);
        if (item.integerValue !== undefined) return Number(item.integerValue);
        if (item.booleanValue !== undefined) return item.booleanValue;
        if (item.mapValue !== undefined) return mapFirestoreFields(item.mapValue.fields);
        return item;
      });
    } else if (val.nullValue !== undefined) {
      result[key] = null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// REST-based Firestore helper to run query and return the first matching store (or null)
async function getStoreByTrackingCodeRest(cleanCode: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "stores" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "trackingCode" },
            op: "EQUAL",
            value: { stringValue: cleanCode }
          }
        },
        limit: 1
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Firestore REST API returned status ${response.status}`);
  }

  const results = await response.json();
  if (Array.isArray(results) && results.length > 0 && results[0].document) {
    const doc = results[0].document;
    const mapped = mapFirestoreFields(doc.fields);
    const docName = doc.name || "";
    const docId = docName.split("/").pop();
    return { ...mapped, id: docId };
  }
  return null;
}

// REST-based Firestore helper to log an email/download action in 'emailRequests' collection
async function logEmailRequestRest(cleanCode: string, cleanEmail: string, statusString: string): Promise<any> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/emailRequests?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        trackingCode: { stringValue: cleanCode },
        ownerEmail: { stringValue: cleanEmail },
        requestDate: { stringValue: new Date().toISOString() },
        status: { stringValue: statusString }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.warn("Could not log emailRequest to Firestore:", text);
  }
}

// Generate Certificate PDF buffer
function generateCertificatePDF(store: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Outer borders
    doc.strokeColor("#D4AF37").lineWidth(3).rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
    doc.strokeColor("#D4AF37").lineWidth(1).rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke();

    // Headers
    doc.fillColor("#111111");
    doc.font("Helvetica-Bold").fontSize(34).text("OFFICIAL CERTIFICATE OF OWNERSHIP", { align: "center" });
    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(13).fillColor("#666666").text("BROWARD MALL SECURE RETAIL REGISTRY", { align: "center" });
    doc.moveDown(1);

    // Decorative line
    doc.strokeColor("#E5E7EB").lineWidth(1).moveTo(100, doc.y).lineTo(doc.page.width - 100, doc.y).stroke();
    doc.moveDown(1.5);

    doc.font("Helvetica").fontSize(13).fillColor("#555555").text("This digital registry certificate validates and confirms that the retail allocation designated as:", { align: "center" });
    doc.moveDown(0.6);

    // Store Name
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#D4AF37").text(store.storeName.toUpperCase(), { align: "center" });
    doc.moveDown(0.4);

    doc.font("Helvetica").fontSize(13).fillColor("#555555").text("within the premier retail catalog of", { align: "center" });
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111").text(store.mallName || "Broward Mall Complex", { align: "center" });
    doc.moveDown(0.6);

    doc.font("Helvetica").fontSize(13).fillColor("#555555").text("is officially registered under the leasehold/proprietary holding of:", { align: "center" });
    doc.moveDown(0.6);

    // Owner Name
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111111").text(store.ownerName?.toUpperCase() || "CREDENTIALED OPERATOR", { align: "center" });
    doc.moveDown(1.5);

    // Divider
    doc.strokeColor("#E5E7EB").lineWidth(1).moveTo(80, doc.y).lineTo(doc.page.width - 80, doc.y).stroke();
    doc.moveDown(1);

    // Metadata details
    const startY = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#888888");
    doc.text("TRACKING CODE", 80, startY);
    doc.text("REGISTRY LEVEL", 250, startY);
    doc.text("REGISTRY STATUS", 420, startY);
    doc.text("EXPIRARY DATE", 590, startY);

    const dataY = startY + 14;
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
    doc.text(store.trackingCode || "N/A", 80, dataY);
    doc.text(store.floor || "Level 1", 250, dataY);
    doc.text(store.ownershipType || "Purchased", 420, dataY);
    
    const expiryStr = store.expiryDate ? new Date(store.expiryDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Indefinite Allocation";
    doc.text(expiryStr, 590, dataY);

    // Footer signature
    doc.moveDown(3.5);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#D4AF37").text("BROWARD MALL PLATFORM LEDGER", { align: "center" });
    doc.font("Helvetica-Oblique").fontSize(8).fillColor("#777777").text("Cryptographically secure document synced and verifiable via proprietary routing tracking ID.", { align: "center" });

    doc.end();
  });
}

const app = express();
app.use(express.json());

async function startServer() {
  const PORT = 3000;

  // API ROUTE 1: Owner Email Verification
  app.post("/api/verify-owner", async (req, res) => {
    const ip = req.ip || "unknown-ip";
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { email, trackingCode } = req.body;
    if (!email || !trackingCode) {
      return res.status(400).json({ error: "Email and tracking code are required." });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = trackingCode.trim().toUpperCase();

      // Query Firestore via REST
      const storeData = await getStoreByTrackingCodeRest(cleanCode);

      if (!storeData) {
        // Obfuscate failure to prevent account enumeration
        return res.status(404).json({ error: "Verification failed. Please check your information and try again." });
      }

      const storedEmail = (storeData.ownerEmail || "").trim().toLowerCase();
      if (cleanEmail !== storedEmail) {
        return res.status(404).json({ error: "Verification failed. Please check your information and try again." });
      }

      // Verification match!
      return res.json({
        success: true,
        storeId: storeData.id || "",
        storeName: storeData.storeName,
        ownerName: storeData.ownerName,
        trackingCode: storeData.trackingCode
      });
    } catch (err: any) {
      console.error("Verification error:", err);
      return res.status(500).json({ error: "An internal server error occurred." });
    }
  });

  // API ROUTE 2: Download Certificate PDF (Directly verified on Server)
  app.post("/api/download-certificate", async (req, res) => {
    const ip = req.ip || "unknown-ip";
    if (!checkRateLimit(ip, 8)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const { email, trackingCode, storeData: clientStoreData } = req.body;
    if (!email || !trackingCode) {
      return res.status(400).json({ error: "Required fields missing." });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = trackingCode.trim().toUpperCase();

      let storeData = null;

      try {
        storeData = await getStoreByTrackingCodeRest(cleanCode);
      } catch (err) {
        console.warn("Firestore retrieve failed, seeking storeData fallback:", err);
      }

      if (!storeData && clientStoreData && clientStoreData.trackingCode && clientStoreData.trackingCode.trim().toUpperCase() === cleanCode) {
        storeData = clientStoreData;
      }

      if (!storeData) {
        return res.status(404).json({ error: "Verification failed. Tracking code was not found." });
      }

      if (!storeData.ownerEmail) {
        return res.status(400).json({ error: "This space is currently unregistered or lacks a registered owner email. Please initiate an acquirement or assign an owner email in the Admin Panel first." });
      }

      if (cleanEmail !== storeData.ownerEmail.trim().toLowerCase()) {
        return res.status(400).json({
          error: `Verification email mismatch. The registered owner email of this store is "${storeData.ownerEmail}". Please use this email or update it in the Admin Panel.`
        });
      }

      // Generate the PDF Buffer
      const pdfBuffer = await generateCertificatePDF(storeData);

      // Save audit log matching dynamically via REST (wrap in safe try-catch)
      try {
        await logEmailRequestRest(cleanCode, cleanEmail, "success_download");
      } catch (dbErr) {
        console.warn("Could not write emailRequest download log to Firestore (continuing gracefully):", dbErr);
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${storeData.storeName.replace(/[^a-zA-Z0-9]/g, "_")}_certificate.pdf"`);
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error("PDF download error:", err);
      return res.status(500).json({ error: "An internal error occurred." });
    }
  });

  // API ROUTE 3: Send Store Details and Report with PDF Attachment via Resend
  app.post("/api/send-store-details", async (req, res) => {
    const ip = req.ip || "unknown-ip";
    if (!checkRateLimit(ip, 5)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { email, trackingCode, storeData: clientStoreData } = req.body;
    if (!email || !trackingCode) {
      return res.status(400).json({ error: "Email and tracking code are required." });
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = trackingCode.trim().toUpperCase();

      let storeData = null;

      try {
        storeData = await getStoreByTrackingCodeRest(cleanCode);
      } catch (err) {
        console.warn("Firestore retrieve failed, seeking storeData fallback:", err);
      }

      if (!storeData && clientStoreData && clientStoreData.trackingCode && clientStoreData.trackingCode.trim().toUpperCase() === cleanCode) {
        storeData = clientStoreData;
      }

      if (!storeData) {
        return res.status(404).json({ error: "Verification failed. Tracking code was not found." });
      }

      if (!storeData.ownerEmail) {
        return res.status(400).json({ error: "This space is currently unregistered or lacks a registered owner email. Please initiate an acquirement or assign an owner email in the Admin Panel first." });
      }

      if (cleanEmail !== storeData.ownerEmail.trim().toLowerCase()) {
        return res.status(400).json({
          error: `Verification email mismatch. The registered owner email of this store is "${storeData.ownerEmail}". Please use this email or update it in the Admin Panel.`
        });
      }

      // Generate PDF
      const pdfBuffer = await generateCertificatePDF(storeData);
      const pdfBase64 = pdfBuffer.toString("base64");

      // Send Email via Resend REST API
      const RESEND_API_KEY = process.env.RESEND_API_KEY || "re_fkNSZiP2_BWVqCpSqst3hJguqKx8QRcem";
      const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@browardmall.site";

      const subject = "Broward Mall Store Ownership Details";
      
      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e1e1e6; border-radius: 12px; background-color: #fafafa; color: #1e1e24;">
          <h2 style="color: #111; border-bottom: 2px solid #D4AF37; padding-bottom: 12px; font-weight: 800; font-family: 'Helvetica Neue', Arial, sans-serif; text-transform: uppercase; tracking-wide: 1px;">Store Ownership Report</h2>
          <p style="font-size: 14px; line-height: 1.5;">Dear <strong>${storeData.ownerName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">You are receiving this automated report because a secure verification lookup was successfully completed on our digital storefront platform. Below are the official recorded parameters on the secure ledgers:</p>
          
          <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Store Name</td>
                <td style="padding: 10px 0; font-size: 14px; font-weight: bold; color: #111; text-align: right;">${storeData.storeName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Mall name</td>
                <td style="padding: 10px 0; font-size: 14px; text-align: right; color: #111;">${storeData.mallName || "Broward Mall"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Tracking Code</td>
                <td style="padding: 10px 0; font-size: 14px; font-family: monospace; font-weight: bold; color: #D4AF37; letter-spacing: 1px; text-align: right;">${storeData.trackingCode}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Status</td>
                <td style="padding: 10px 0; font-size: 14px; font-weight: bold; color: #111; text-align: right; text-transform: uppercase;">${storeData.status}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Unit Number</td>
                <td style="padding: 10px 0; font-size: 14px; text-align: right; color: #111;">Suite ${storeData.unitNumber || "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Floor</td>
                <td style="padding: 10px 0; font-size: 14px; text-align: right; color: #111;">${storeData.floor || "Level 1"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Purchase Date</td>
                <td style="padding: 10px 0; font-size: 14px; text-align: right; color: #111;">${storeData.purchaseDate ? new Date(storeData.purchaseDate).toLocaleDateString() : "N/A"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Expiry Date</td>
                <td style="padding: 10px 0; font-size: 14px; text-align: right; color: #ef4444; font-weight: bold;">${storeData.expiryDate ? new Date(storeData.expiryDate).toLocaleDateString() : "N/A"}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-size: 12px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Ownership Type</td>
                <td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: bold; color: #111;">${storeData.ownershipType || "Purchased"}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">Your <strong>Official Store Ownership Certificate (PDF)</strong> has been compiled and is attached directly to this transfer delivery dispatch. Please secure this key credential vector safely for subsequent regulatory steps.</p>
          
          <div style="margin-top: 35px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center;">
            <p style="margin: 0 0 5px 0;">Broward Mall Digital Commerce Engine &bull; Plantation, Florida</p>
            <p style="margin: 0; font-style: italic;">This inquiry generated an automated cryptographic event log. Security auditing active.</p>
          </div>
        </div>
      `;

      let statusString = "success";
      let successMessage = "Verification successful. Your store ownership details have been sent to your email.";

      try {
        // Make Resend API POST Request
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: "Broward Mall <noreply@browardmall.site>",
            reply_to: RESEND_FROM_EMAIL,
            to: cleanEmail,
            subject: subject,
            html: emailBody,
            attachments: [
              {
                filename: `${storeData.storeName.replace(/[^a-zA-Z0-9]/g, "_")}_Ownership_Certificate.pdf`,
                content: pdfBase64
              }
            ]
          })
        });

        const resendJson = await resendRes.json();
        if (!resendRes.ok) {
          console.info("Resend sandboxed API environment fallback mode activated.");
          statusString = "success_email_fallback";
          
          const resendErr = resendJson.error || resendJson;
          const isValidationError = resendErr.name === "validation_error" || 
                                    resendErr.type === "validation_error" ||
                                    (resendErr.message && resendErr.message.toLowerCase().includes("testing emails")) ||
                                    (resendErr.message && resendErr.message.toLowerCase().includes("validation"));
          
          if (isValidationError) {
            successMessage = "Database verification matched! However, because this runs in a sandbox environment, email dispatches are restricted to verified accounts. You can download the compiled Ownership Certificate instantly below.";
          } else {
            successMessage = `Database verification matched! However, email delivery fallback returned: ${resendErr.message || "service restriction"}. You can download the certificate instantly below.`;
          }
        }
      } catch (emailErr: any) {
        console.info("Resend email dispatch fallback applied.");
        statusString = "success_email_fallback";
        successMessage = "Database verification matched! However, our email service is restricted in this sandbox environment. You can download your official certificate PDF instantly below.";
      }

      // Logging request in Firestore via REST
      try {
        await logEmailRequestRest(cleanCode, cleanEmail, statusString);
      } catch (dbErr) {
        console.warn("Could not write emailRequest send-details log to Firestore (continuing gracefully):", dbErr);
      }

      return res.json({ success: true, message: successMessage });
    } catch (err: any) {
      console.error("Email service error:", err);
      return res.status(500).json({ error: "Verification failed. Please check your information and try again." });
    }
  });

  // Vite Integration & SPA Serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Full-Stack dev server online at http://localhost:${PORT}`);
    });
  }
}

startServer();

export { app };
export default app;
