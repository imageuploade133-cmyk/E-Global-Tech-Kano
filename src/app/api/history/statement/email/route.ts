import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateUserRequest } from "@/lib/auth-util";
import { sendEmail } from "@/lib/email-service";
import { formatTransactionDateTime } from "@/lib/date-utils";
import { isCreditTransaction, getTransactionDisplayAmount } from "@/lib/transaction-status-normalizer";

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

    // Fetch app config for statement logo, signature, and stamp
    let statementLogoUrl = "https://i.ibb.co/WWjZrtC7/E-Tech.png";
    let statementSignatureUrl = "";
    let statementStampUrl = "";

    try {
      const appConfigSnap = await adminDb.collection("config").doc("app").get();
      if (appConfigSnap.exists) {
        const cfg = appConfigSnap.data() || {};
        statementLogoUrl = cfg.statementLogoUrl || cfg.logoUrl || statementLogoUrl;
        statementSignatureUrl = cfg.statementSignatureUrl || "";
        statementStampUrl = cfg.statementStampUrl || "";
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

    const emailHtml = `
      <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 680px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
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
    `;

    const sent = await sendEmail({
      to: targetEmail,
      subject: `Statement of Account (${fromDate} to ${toDate}) - E-Global Pay`,
      html: emailHtml,
    });

    if (sent) {
      return NextResponse.json({
        success: true,
        message: `Statement of Account successfully sent to ${targetEmail}!`,
      });
    } else {
      return NextResponse.json({
        error: "Failed to dispatch email statement. Please try PDF download option.",
      }, { status: 502 });
    }

  } catch (err: any) {
    console.error("[Statement Email Route Exception]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to generate statement email" }, { status: 500 });
  }
}
