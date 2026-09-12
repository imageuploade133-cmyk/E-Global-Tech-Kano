import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateUserRequest } from "@/lib/auth-util";
import { sendEmail } from "@/lib/email-service";
import { formatTransactionDateTime } from "@/lib/date-utils";
import { isCreditTransaction, getTransactionDisplayAmount } from "@/lib/transaction-status-normalizer";
import jsPDF from "jspdf";

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (err: any) {
    console.warn(`[fetchImageAsDataUri] Warning fetching image ${url}:`, err.message);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    let uid = "";
    let userEmail = "";
    try {
      const authUser = await authenticateUserRequest(req);
      uid = authUser.uid;
      userEmail = authUser.email || "";
    } catch {
      return NextResponse.json({ error: "Unauthorized: Please sign in to request statement." }, { status: 401 });
    }

    const body = await req.json();
    const { fromDate, toDate } = body;

    if (!fromDate || !toDate) {
      return NextResponse.json({ error: "Please select both From Date and To Date." }, { status: 400 });
    }

    const start = new Date(fromDate + "T00:00:00.000Z");
    const end = new Date(toDate + "T23:59:59.999Z");

    if (start > end) {
      return NextResponse.json({ error: "From Date cannot be later than To Date." }, { status: 400 });
    }

    const sixMonthsInMs = 183 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > sixMonthsInMs) {
      return NextResponse.json({ error: "Statements are limited to a maximum range of 6 months at a time." }, { status: 400 });
    }

    // Fetch app config for statement logo, signature, stamp, and traditional watermark
    let statementLogoUrl = "https://i.ibb.co/WWjZrtC7/E-Tech.png";
    let statementSignatureUrl = "";
    let statementStampUrl = "";
    let statementWatermarkUrl = "";
    let statementWatermarkSize = 100;
    let statementWatermarkOpacity = 0.15;

    try {
      const appConfigSnap = await adminDb.collection("config").doc("app").get();
      if (appConfigSnap.exists) {
        const cfg = appConfigSnap.data() || {};
        statementLogoUrl = cfg.statementLogoUrl || cfg.logoUrl || statementLogoUrl;
        statementSignatureUrl = cfg.statementSignatureUrl || "";
        statementStampUrl = cfg.statementStampUrl || "";
        statementWatermarkUrl = cfg.statementWatermarkUrl || "";
        statementWatermarkSize = cfg.statementWatermarkSize || 100;
        statementWatermarkOpacity = cfg.statementWatermarkOpacity ?? 0.15;
      }
    } catch (cfgErr: any) {
      console.warn("[Statement Email Route] Config lookup warning:", cfgErr.message);
    }

    // Fetch user profile name
    const userDocSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userDocSnap.exists ? userDocSnap.data() || {} : {};
    const userName = userData.name || userData.displayName || "E-Global Pay Valued Customer";
    const targetEmail = userData.email || userEmail;

    if (!targetEmail) {
      return NextResponse.json({ error: "No registered email address found for your account." }, { status: 400 });
    }

    // Fetch transactions
    const txSnap = await adminDb
      .collection("transactions")
      .where("userId", "==", uid)
      .where("createdAt", ">=", start.toISOString())
      .where("createdAt", "<=", end.toISOString())
      .orderBy("createdAt", "desc")
      .get();

    const txList: any[] = [];
    txSnap.forEach((doc) => txList.push(doc.data()));

    if (txList.length === 0) {
      return NextResponse.json({ error: "No transactions found for the selected date range." }, { status: 404 });
    }

    const tableRows = txList
      .map((tx) => {
        const { dateTime } = formatTransactionDateTime(tx.createdAt, tx.date, tx.time);
        const isCredit = isCreditTransaction(tx);
        const displayAmt = getTransactionDisplayAmount(tx);

        return `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 600; color: #334155;">${dateTime}</td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 700; color: #0f172a;">${(tx.description || tx.title || "Transaction").toString().slice(0, 45)}</td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">${(tx.type || "PAYMENT").toString()}</td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 800; text-align: right; color: ${isCredit ? "#10b981" : "#0f172a"};">
              ${isCredit ? "+" : "-"}₦${displayAmt.toLocaleString()}
            </td>
          </tr>
        `;
      })
      .join("");

    const signatureStampSection = (statementSignatureUrl || statementStampUrl) ? `
      <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
        ${statementSignatureUrl ? `
          <div style="text-align: left;">
            <p style="margin: 0 0 6px 0; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #94a3b8;">Authorized Signatory</p>
            <img src="${statementSignatureUrl}" alt="Authorized Signature" style="max-height: 44px; width: auto;" />
          </div>
        ` : `<div></div>`}
        ${statementStampUrl ? `
          <div style="text-align: right;">
            <p style="margin: 0 0 6px 0; font-size: 9px; font-weight: 800; text-transform: uppercase; color: #94a3b8;">Official Verification Stamp</p>
            <img src="${statementStampUrl}" alt="Official Stamp" style="max-height: 52px; width: auto;" />
          </div>
        ` : `<div></div>`}
      </div>
    ` : "";

    const watermarkSectionHtml = statementWatermarkUrl ? `
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: ${statementWatermarkOpacity}; width: ${Math.min(500, Math.max(120, statementWatermarkSize * 2.5))}px; max-width: 80%; pointer-events: none; z-index: 0; text-align: center;">
        <img src="${statementWatermarkUrl}" alt="Watermark" style="width: 100%; height: auto; max-height: 500px; object-fit: contain;" />
      </div>
    ` : "";

    const emailHtml = `
      <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 680px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03); position: relative; overflow: hidden;">
        ${watermarkSectionHtml}
        <div style="position: relative; z-index: 1;">
        <!-- Brand Header -->
        <div style="background: linear-gradient(135deg, #FC7A00 0%, #E06600 100%); padding: 20px 24px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${statementLogoUrl}" alt="E-Global Pay" style="height: 40px; width: auto; background: #ffffff; padding: 4px; border-radius: 8px;" />
            <div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px;">E-GLOBAL PAY</h1>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Official Financial Statement</p>
            </div>
          </div>
        </div>

        <p style="font-size: 14px; color: #1e293b; margin-top: 0;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 13px; color: #475569; line-height: 1.5;">Please find below your requested electronic <strong>Statement of Account</strong> for the period <strong>${fromDate}</strong> to <strong>${toDate}</strong>.</p>

        <!-- Summary Specs -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin: 20px 0; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 800; display: block;">Account Holder</span>
            <strong style="font-size: 12px; color: #0f172a;">${userName}</strong>
          </div>
          <div>
            <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 800; display: block;">Date Period</span>
            <strong style="font-size: 12px; color: #0f172a;">${fromDate} ~ ${toDate}</strong>
          </div>
          <div>
            <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 800; display: block;">Total Transactions</span>
            <strong style="font-size: 12px; color: #FC7A00;">${txList.length} Record(s)</strong>
          </div>
        </div>

        <!-- Statement Table -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #475569; font-size: 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; border-top-left-radius: 8px;">Date & Time</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Description</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Type</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right; border-top-right-radius: 8px;">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        ${signatureStampSection}

        <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="margin: 0; font-size: 11px; font-weight: 700; color: #64748b;">E-Global Pay Automated Electronic Financial Statement</p>
          <p style="margin: 4px 0 0 0; font-size: 10px; color: #94a3b8;">Generated automatically on ${new Date().toLocaleString()} • Confidential & Private</p>
        </div>
        </div>
      </div>
    `;

    // Generate server-side PDF attachment using jsPDF
    let pdfBase64 = "";
    try {
      const doc = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
      });

      // Pre-fetch Data URIs for remote images so jsPDF doc.addImage never fails on raw HTTP URLs
      const watermarkDataUri = statementWatermarkUrl ? await fetchImageAsDataUri(statementWatermarkUrl) : null;
      const signatureDataUri = statementSignatureUrl ? await fetchImageAsDataUri(statementSignatureUrl) : null;
      const stampDataUri = statementStampUrl ? await fetchImageAsDataUri(statementStampUrl) : null;

      // Background watermark opacity
      if (watermarkDataUri) {
        try {
          doc.saveGraphicsState();
          (doc as any).setGState(new (doc as any).GState({ opacity: statementWatermarkOpacity }));
          const wmWidth = statementWatermarkSize;
          const wmHeight = statementWatermarkSize;
          const wmX = (210 - wmWidth) / 2;
          const wmY = (297 - wmHeight) / 2;
          doc.addImage(watermarkDataUri, "PNG", wmX, wmY, wmWidth, wmHeight);
          doc.restoreGraphicsState();
        } catch {}
      }

      // Brand Header
      doc.setFillColor(252, 122, 0); // #FC7A00
      doc.rect(14, 12, 182, 22, "F");

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("E-GLOBAL PAY", 22, 23);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("OFFICIAL FINANCIAL STATEMENT OF ACCOUNT", 22, 28);

      // Account Overview Box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 38, 182, 20, 3, 3, "F");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("ACCOUNT HOLDER", 20, 45);
      doc.text("STATEMENT PERIOD", 85, 45);
      doc.text("TOTAL TRANSACTIONS", 145, 45);

      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(String(userName).slice(0, 30), 20, 52);
      doc.text(`${fromDate} to ${toDate}`, 85, 52);
      doc.text(`${txList.length} Record(s)`, 145, 52);

      // Table Header
      let yPos = 66;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, yPos, 182, 7, "F");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("DATE & TIME", 18, yPos + 5);
      doc.text("DESCRIPTION", 60, yPos + 5);
      doc.text("TYPE", 130, yPos + 5);
      doc.text("AMOUNT (NGN)", 188, yPos + 5, { align: "right" });

      yPos += 11;

      // Table Rows
      txList.forEach((tx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;

          // Header on new page
          doc.setFillColor(241, 245, 249);
          doc.rect(14, yPos, 182, 7, "F");
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(71, 85, 105);
          doc.text("DATE & TIME", 18, yPos + 5);
          doc.text("DESCRIPTION", 60, yPos + 5);
          doc.text("TYPE", 130, yPos + 5);
          doc.text("AMOUNT (NGN)", 188, yPos + 5, { align: "right" });
          yPos += 11;
        }

        const { dateTime } = formatTransactionDateTime(tx.createdAt, tx.date, tx.time);
        const isCredit = isCreditTransaction(tx);
        const displayAmt = getTransactionDisplayAmount(tx);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.text(dateTime, 18, yPos);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(String(tx.description || tx.title || "Transaction").slice(0, 38), 60, yPos);

        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(String(tx.type || "PAYMENT").toUpperCase(), 130, yPos);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        if (isCredit) {
          doc.setTextColor(16, 185, 129); // green
          doc.text(`+N${displayAmt.toLocaleString()}`, 188, yPos, { align: "right" });
        } else {
          doc.setTextColor(15, 23, 42); // dark
          doc.text(`-N${displayAmt.toLocaleString()}`, 188, yPos, { align: "right" });
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(14, yPos + 2, 196, yPos + 2);

        yPos += 7.5;
      });

      // Signature & Stamp
      if (yPos + 25 < 280) {
        if (signatureDataUri) {
          try {
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(148, 163, 184);
            doc.text("AUTHORIZED SIGNATORY", 18, yPos + 6);
            doc.addImage(signatureDataUri, "PNG", 18, yPos + 8, 30, 12);
          } catch {}
        }
        if (stampDataUri) {
          try {
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(148, 163, 184);
            doc.text("OFFICIAL STAMP", 150, yPos + 6);
            doc.addImage(stampDataUri, "PNG", 150, yPos + 8, 20, 20);
          } catch {}
        }
      }

      // Footer
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("Official E-Global Pay Automated Electronic Statement • Confidential & Private", 14, 288);

      const pdfOutput = doc.output("arraybuffer");
      pdfBase64 = Buffer.from(pdfOutput).toString("base64");
    } catch (pdfErr: any) {
      console.warn("[Statement Email Route] Server PDF generation warning:", pdfErr.message);
    }

    const attachments = pdfBase64
      ? [
          {
            filename: `EGlobalPay_Statement_${fromDate}_to_${toDate}.pdf`,
            content: pdfBase64,
            contentType: "application/pdf",
          },
        ]
      : undefined;

    let sent = await sendEmail({
      to: targetEmail,
      subject: `Statement of Account (${fromDate} to ${toDate}) - E-Global Pay`,
      html: emailHtml,
      attachments,
    });

    // Fallback: If sending with attachment fails, retry dispatching pure HTML table email
    if (!sent && attachments) {
      console.warn("[Statement Email Route] Attachment dispatch failed. Retrying dispatch as pure HTML table email...");
      sent = await sendEmail({
        to: targetEmail,
        subject: `Statement of Account (${fromDate} to ${toDate}) - E-Global Pay`,
        html: emailHtml,
      });
    }

    if (sent) {
      return NextResponse.json({
        success: true,
        message: `Statement of Account successfully sent to ${targetEmail}!`,
      });
    } else {
      return NextResponse.json({
        error: "Failed to dispatch email statement. Please check your email configuration.",
      }, { status: 502 });
    }

  } catch (err: any) {
    console.error("[Statement Email Route Exception]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to generate statement email" }, { status: 500 });
  }
}
