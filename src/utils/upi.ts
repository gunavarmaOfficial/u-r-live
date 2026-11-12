import QRCode from 'qrcode';

/**
 * Standard NPCI UPI URI Generator & Deep-Link Launcher for U-R-LIVE
 * 
 * Spec: NPCI UPI Linking Specification v1.6 / RFC 3986
 * Format: upi://pay?pa=UPI_ID&pn=UR%20LIVE&am=299.00&cu=INR&tn=Premium%20Subscription
 */

export interface UpiPaymentConfig {
  upiId: string;
  payeeName?: string;
  amount: number;
  currency?: string;
  transactionNote?: string;
  transactionRef?: string;
}

export type UpiAppId = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'generic';

export interface UpiAppConfig {
  id: UpiAppId;
  name: string;
  displayName: string;
  androidPackage: string;
  iosScheme: string;
  logo: string;
}

export const UPI_APPS: Record<Exclude<UpiAppId, 'generic'>, UpiAppConfig> = {
  gpay: {
    id: 'gpay',
    name: 'Google Pay',
    displayName: 'Google Pay',
    androidPackage: 'com.google.android.apps.nbu.paisa.user',
    iosScheme: 'gpay://upi/pay',
    logo: '/payment-apps/gpay.png',
  },
  phonepe: {
    id: 'phonepe',
    name: 'PhonePe',
    displayName: 'PhonePe',
    androidPackage: 'com.phonepe.app',
    iosScheme: 'phonepe://pay',
    logo: '/payment-apps/phonepe.png',
  },
  paytm: {
    id: 'paytm',
    name: 'Paytm',
    displayName: 'Paytm',
    androidPackage: 'net.one97.paytm',
    iosScheme: 'paytmmp://pay',
    logo: '/payment-apps/paytm.png',
  },
  bhim: {
    id: 'bhim',
    name: 'BHIM UPI',
    displayName: 'BHIM UPI',
    androidPackage: 'in.org.npci.upiapp',
    iosScheme: 'bhim://upi/pay',
    logo: '/payment-apps/bhim.png',
  },
};

/**
 * Validates a UPI ID (Virtual Payment Address - VPA).
 * Must be in format user@psp (e.g. name@okhdfcbank, user@icici, urlive@slc).
 */
export function isValidUpiId(vpa: string): boolean {
  if (!vpa || typeof vpa !== 'string') return false;
  const clean = vpa.trim();
  // Standard VPA: minimum 3 chars before @, at least 2 chars after @, valid characters only
  const vpaRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/;
  return vpaRegex.test(clean);
}

/**
 * Builds standard NPCI-compliant UPI URI with strict RFC 3986 percent-encoding (%20 instead of +).
 * Standard format:
 * upi://pay?pa=UPI_ID&pn=UR%20LIVE&am=299.00&cu=INR&tn=Premium%20Subscription
 */
export function buildStandardUpiUri(config: UpiPaymentConfig): string {
  const cleanUpiId = (config.upiId || '').trim();
  if (!cleanUpiId || !isValidUpiId(cleanUpiId)) {
    throw new Error(`Invalid UPI ID (VPA): "${config.upiId}". Must be in user@handle format.`);
  }

  const numAmount = Number(config.amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error(`Invalid payment amount: ${config.amount}. Must be greater than 0.`);
  }

  const payeeName = (config.payeeName || 'UR LIVE').trim();
  const currency = (config.currency || 'INR').trim().toUpperCase();
  const note = (config.transactionNote || 'Premium Subscription').trim();

  // Use URLSearchParams for safe escaping
  const params = new URLSearchParams();
  params.set('pa', cleanUpiId);
  params.set('pn', payeeName);
  // NPCI requires amount formatted to 2 decimal places (e.g. 299.00)
  params.set('am', numAmount.toFixed(2));
  params.set('cu', currency);
  params.set('tn', note);

  // Optional transaction reference:
  // Note: Only include tr if supported by the merchant flow. For direct P2P VPAs,
  // omitting tr prevents UPI apps from classifying the transfer as an unverified P2M order.
  if (config.transactionRef && config.transactionRef.trim()) {
    params.set('tr', config.transactionRef.trim());
  }

  // URLSearchParams.toString() uses application/x-www-form-urlencoded (spaces as '+', '@' as '%40').
  // NPCI UPI spec requires RFC 3986 percent-encoding for values (spaces as '%20') and raw '@' in VPA (pa).
  const queryString = params
    .toString()
    .replace(/\+/g, '%20')
    .replace(/%40/g, '@');

  return `upi://pay?${queryString}`;
}

/**
 * Generates the platform-appropriate URI for a specific UPI app or universal chooser.
 */
export function getAppUpiLink(
  appId: UpiAppId,
  config: UpiPaymentConfig,
  platform?: { isAndroid?: boolean; isIOS?: boolean }
): string {
  const standardUri = buildStandardUpiUri(config);
  if (appId === 'generic') {
    return standardUri;
  }

  const app = UPI_APPS[appId];
  if (!app) return standardUri;

  const isAndroid =
    platform?.isAndroid ??
    (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent));
  const isIOS =
    platform?.isIOS ??
    (typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent));

  const queryIndex = standardUri.indexOf('?');
  const query = queryIndex !== -1 ? standardUri.substring(queryIndex + 1) : '';

  if (isAndroid) {
    // Android Chrome Intent syntax targeting specific UPI application package
    // Syntax: intent://pay?<query>#Intent;scheme=upi;package=<package>;end
    return `intent://pay?${query}#Intent;scheme=upi;package=${app.androidPackage};end`;
  }

  if (isIOS) {
    // iOS app-specific URL scheme
    const separator = app.iosScheme.includes('?') ? '&' : '?';
    return `${app.iosScheme}${separator}${query}`;
  }

  // Desktop or unverified fallback: standard upi:// URI
  return standardUri;
}

/**
 * Generates an accurate, standard QR code Data URL (PNG) from the exact standard UPI URI.
 */
export async function generateUpiQrDataUrl(
  config: UpiPaymentConfig,
  options?: { width?: number; margin?: number }
): Promise<string> {
  const uri = buildStandardUpiUri(config);
  return QRCode.toDataURL(uri, {
    width: options?.width || 320,
    margin: options?.margin || 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}

