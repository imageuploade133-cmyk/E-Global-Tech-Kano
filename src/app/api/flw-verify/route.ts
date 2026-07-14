import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.FLW_BASE_URL || "https://api.flutterwave.com/v3";
  const publicKey = process.env.FLW_PUBLIC_KEY;
  const secretKey = process.env.FLW_SECRET_KEY;
  const webhookSecret = process.env.FLW_WEBHOOK_SECRET;

  const missingVars: string[] = [];

  if (!process.env.FLW_BASE_URL) {
    // Treat as warning or missing depending on strictness, let's strictly require it if user specified it in set parameters
    missingVars.push("FLW_BASE_URL");
  }
  if (!publicKey) {
    missingVars.push("FLW_PUBLIC_KEY");
  }
  if (!secretKey) {
    missingVars.push("FLW_SECRET_KEY");
  }
  if (!webhookSecret) {
    missingVars.push("FLW_WEBHOOK_SECRET");
  }

  // If any critical production variable is missing, return a descriptive error
  if (missingVars.length > 0) {
    return NextResponse.json(
      {
        error: "Configuration Error: Missing Flutterwave Environment Variables",
        missingVariables: missingVars,
        details: `The following environment parameters must be configured on your host server: ${missingVars.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Successfully load environment checks
  return NextResponse.json(
    {
      baseUrl,
      hasPublicKey: !!publicKey,
      hasSecretKey: !!secretKey,
      hasWebhookSecret: !!webhookSecret,
    },
    { status: 200 }
  );
}
