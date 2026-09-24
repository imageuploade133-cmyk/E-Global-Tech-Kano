import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

async function generateKeyPair() {
  const keysDir = path.join(__dirname, '..', 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }

  const privateKeyPath = path.join(keysDir, 'bundle_private_key.pem');
  const publicKeyPath = path.join(keysDir, 'bundle_public_key.pem');

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    console.log('Using existing RSA key pair from scripts/keys/');
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    return { privateKey, publicKey };
  }

  console.log('Generating new RSA-2048 key pair...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  fs.writeFileSync(privateKeyPath, privateKey);
  fs.writeFileSync(publicKeyPath, publicKey);

  console.log(`Saved RSA keys to ${keysDir}`);
  return { privateKey, publicKey };
}

function createZipArchiveNative(sourceDir: string, outZipPath: string): void {
  const zipCmd = `cd "${sourceDir}" && zip -r -9 "${outZipPath}" .`;
  execSync(zipCmd, { stdio: 'inherit' });
}

function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
}

function signManifestPayload(payloadString: string, privateKeyPem: string): string {
  const sign = crypto.createSign('SHA256');
  sign.update(payloadString);
  sign.end();
  return sign.sign(privateKeyPem, 'base64');
}

async function main() {
  const bundleVersion = process.env.BUNDLE_VERSION || '1.0.1';
  console.log(`Starting Mobile Bundle Generation for version ${bundleVersion}...`);

  const { privateKey, publicKey } = await generateKeyPair();

  const outBaseDir = path.join(__dirname, '..', 'public', 'mobile-bundles');
  const versionBundleDir = path.join(outBaseDir, bundleVersion);
  if (!fs.existsSync(versionBundleDir)) {
    fs.mkdirSync(versionBundleDir, { recursive: true });
  }

  // Mobile APK repository path dynamically resolved from environment, sibling directory, or /tmp
  const candidateApkPaths = [
    process.env.MOBILE_APP_PATH,
    path.resolve(path.join(__dirname, '..', '..', 'E-Global-APK-IOS')),
    '/tmp/E-Global-APK-IOS',
  ].filter(Boolean) as string[];

  const apkRepoPath = candidateApkPaths.find((p) => fs.existsSync(p)) || '';
  const apkAssetsWebDir = apkRepoPath ? path.join(apkRepoPath, 'assets', 'web') : '';
  let sourceWebDir = path.join(__dirname, '..', 'out');

  if (!fs.existsSync(sourceWebDir) || !fs.existsSync(path.join(sourceWebDir, 'index.html'))) {
    if (apkAssetsWebDir && fs.existsSync(apkAssetsWebDir) && fs.existsSync(path.join(apkAssetsWebDir, 'index.html'))) {
      console.log(`Using existing static bundle assets from ${apkAssetsWebDir}`);
      sourceWebDir = apkAssetsWebDir;
    } else {
      console.error(`Error: Static bundle assets not found at ${sourceWebDir} or ${apkAssetsWebDir}`);
      process.exit(1);
    }
  }

  const zipPath = path.resolve(path.join(versionBundleDir, 'bundle.zip'));
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`Zipping static export from ${sourceWebDir} into ${zipPath}...`);
  createZipArchiveNative(sourceWebDir, zipPath);

  const stats = fs.statSync(zipPath);
  const size = stats.size;
  const sha256Hex = computeSha256(zipPath);
  const bundleUrl = `https://e-global-197077.vercel.app/mobile-bundles/${bundleVersion}/bundle.zip`;

  const signableData = `${bundleVersion}|${bundleUrl}|${sha256Hex}|${size}`;
  const signature = signManifestPayload(signableData, privateKey);

  const manifest = {
    bundleVersion,
    bundleUrl,
    sha256: sha256Hex,
    size,
    signature,
    createdAt: new Date().toISOString(),
    requiredFiles: ['index.html'],
  };

  const manifestPath = path.join(outBaseDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Successfully generated mobile bundle v${bundleVersion}!`);
  console.log(`Manifest URL: https://e-global-197077.vercel.app/mobile-bundles/manifest.json`);
  console.log(`Bundle URL: ${bundleUrl}`);
  console.log(`SHA-256: ${sha256Hex}`);
  console.log(`Size: ${size} bytes`);
  console.log(`Signature: ${signature}`);

  // Generate Dart Public Key file to be embedded in Flutter app if mobile repo path exists
  if (apkRepoPath && fs.existsSync(apkRepoPath)) {
    const dartPublicKeyFile = path.join(apkRepoPath, 'lib', 'core', 'constants', 'bundle_public_key.dart');
    if (fs.existsSync(path.dirname(dartPublicKeyFile))) {
      const dartContent = `// Auto-generated public key for RSA-2048 SHA-256 manifest signature verification.
class BundlePublicKey {
  static const String pem = '''
${publicKey.trim()}
''';
}
`;
      fs.writeFileSync(dartPublicKeyFile, dartContent);
      console.log(`Updated Flutter public key constant at ${dartPublicKeyFile}`);
    }
  }
}

main().catch((err) => {
  console.error('Failed to generate mobile bundle:', err);
  process.exit(1);
});
