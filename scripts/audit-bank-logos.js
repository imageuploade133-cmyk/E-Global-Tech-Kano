const fs = require('fs');
const path = require('path');

const LOGOS_DIR = path.join(__dirname, '../public/bank-logos');
const CONFIG_FILE = path.join(__dirname, '../payment-gateway/src/config/nigerian_banks_logos.json');

function padCode(code) {
  let str = String(code).trim();
  if (/^\d+$/.test(str)) {
    return str.padStart(3, '0');
  }
  return str;
}

function runAudit() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`Config file not found at ${CONFIG_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
  const banks = JSON.parse(raw);

  console.log(`==============================================================================================================================`);
  console.log(`BANK CODE | BANK NAME                                    | LOGO FOUND | LOGO URL                  | STATUS`);
  console.log(`==============================================================================================================================`);

  let totalBanks = banks.length;
  let verifiedLogos = 0;
  let fallbackCount = 0;
  const missingLogosList = [];

  banks.forEach((bank) => {
    const code = padCode(bank.code);
    const logoFileName = `${code}.png`;
    const localLogoPath = path.join(LOGOS_DIR, logoFileName);
    const hasLocalFile = fs.existsSync(localLogoPath);

    let status = "VERIFIED";
    let logoFound = "YES";
    let logoUrl = `/bank-logos/${logoFileName}`;

    if (bank.logo && bank.logo.includes('default_tzmdd0')) {
      status = "FALLBACK (Placeholder in JSON)";
      logoFound = "NO";
      logoUrl = "N/A";
      fallbackCount++;
      missingLogosList.push(bank);
    } else if (!hasLocalFile) {
      status = "FALLBACK (Local file missing)";
      logoFound = "NO";
      logoUrl = "N/A";
      fallbackCount++;
      missingLogosList.push(bank);
    } else {
      // Validate file size is non-zero
      const stats = fs.statSync(localLogoPath);
      if (stats.size === 0) {
        status = "BROKEN (0 bytes file)";
        logoFound = "NO";
        logoUrl = "N/A";
        fallbackCount++;
        missingLogosList.push(bank);
      } else {
        verifiedLogos++;
      }
    }

    console.log(`${code.padEnd(9)} | ${bank.name.padEnd(44)} | ${logoFound.padEnd(10)} | ${logoUrl.padEnd(25)} | ${status}`);
  });

  console.log(`==============================================================================================================================`);
  console.log(`AUDIT SUMMARY:`);
  console.log(`------------------------------------------------------------------------------------------------------------------------------`);
  console.log(`A. Total number of banks returned by Flutterwave configuration: ${totalBanks}`);
  console.log(`B. Number with verified logos: ${verifiedLogos}`);
  console.log(`C. Number still using fallback: ${fallbackCount}`);
  console.log(`------------------------------------------------------------------------------------------------------------------------------`);
  console.log(`D. Complete list of banks still without verified logos:`);
  missingLogosList.forEach((b) => {
    console.log(`   - [${padCode(b.code)}] ${b.name}`);
  });
  console.log(`==============================================================================================================================`);
}

runAudit();
