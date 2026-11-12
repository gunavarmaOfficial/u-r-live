import { describe, it, expect } from 'vitest';
import {
  buildStandardUpiUri,
  getAppUpiLink,
  isValidUpiId,
  UPI_APPS,
} from './upi';

describe('UPI Utility - Validation & URI Generator', () => {
  it('validates correct UPI IDs (VPAs)', () => {
    expect(isValidUpiId('urlive@slc')).toBe(true);
    expect(isValidUpiId('gunavarma0000-5@okicici')).toBe(true);
    expect(isValidUpiId('merchant@hdfcbank')).toBe(true);
    expect(isValidUpiId('user.name@ybl')).toBe(true);

    expect(isValidUpiId('')).toBe(false);
    expect(isValidUpiId('invalidupi')).toBe(false);
    expect(isValidUpiId('@handle')).toBe(false);
    expect(isValidUpiId('user@')).toBe(false);
    expect(isValidUpiId('spaces in@vpa')).toBe(false);
  });

  it('builds standard NPCI-compliant UPI payment URI', () => {
    const uri = buildStandardUpiUri({
      upiId: 'urlive@slc',
      payeeName: 'UR LIVE',
      amount: 299,
      currency: 'INR',
      transactionNote: 'Premium Subscription',
    });

    expect(uri).toBe(
      'upi://pay?pa=urlive@slc&pn=UR%20LIVE&am=299.00&cu=INR&tn=Premium%20Subscription'
    );
  });

  it('strictly encodes spaces as %20 instead of + in payee name and note', () => {
    const uri = buildStandardUpiUri({
      upiId: 'urlive@slc',
      payeeName: 'UR LIVE PRO',
      amount: 299,
      transactionNote: 'UR LIVE 30 Days Access',
    });

    expect(uri).not.toContain('+');
    expect(uri).toContain('pn=UR%20LIVE%20PRO');
    expect(uri).toContain('tn=UR%20LIVE%2030%20Days%20Access');
  });

  it('formats amount to two decimal places', () => {
    const uri = buildStandardUpiUri({
      upiId: 'urlive@slc',
      amount: 299,
    });
    expect(uri).toContain('am=299.00');

    const uriDecimal = buildStandardUpiUri({
      upiId: 'urlive@slc',
      amount: 299.5,
    });
    expect(uriDecimal).toContain('am=299.50');
  });

  it('handles optional transaction reference (tr) only when provided', () => {
    const withoutTr = buildStandardUpiUri({
      upiId: 'urlive@slc',
      amount: 299,
    });
    expect(withoutTr).not.toContain('tr=');

    const withTr = buildStandardUpiUri({
      upiId: 'urlive@slc',
      amount: 299,
      transactionRef: 'REF123456',
    });
    expect(withTr).toContain('tr=REF123456');
  });

  it('throws an error for invalid UPI ID or invalid amount', () => {
    expect(() =>
      buildStandardUpiUri({
        upiId: 'invalid-vpa',
        amount: 299,
      })
    ).toThrow('Invalid UPI ID');

    expect(() =>
      buildStandardUpiUri({
        upiId: 'urlive@slc',
        amount: 0,
      })
    ).toThrow('Invalid payment amount');

    expect(() =>
      buildStandardUpiUri({
        upiId: 'urlive@slc',
        amount: -100,
      })
    ).toThrow('Invalid payment amount');
  });

  it('generates correct Android Intent URLs with target packages', () => {
    const config = {
      upiId: 'urlive@slc',
      amount: 299,
    };

    const gpayIntent = getAppUpiLink('gpay', config, { isAndroid: true, isIOS: false });
    expect(gpayIntent).toContain(
      `package=${UPI_APPS.gpay.androidPackage}`
    );
    expect(gpayIntent).toContain('scheme=upi');
    expect(gpayIntent.startsWith('intent://pay?')).toBe(true);

    const phonepeIntent = getAppUpiLink('phonepe', config, { isAndroid: true, isIOS: false });
    expect(phonepeIntent).toContain(
      `package=${UPI_APPS.phonepe.androidPackage}`
    );
    expect(phonepeIntent.startsWith('intent://pay?')).toBe(true);

    const paytmIntent = getAppUpiLink('paytm', config, { isAndroid: true, isIOS: false });
    expect(paytmIntent).toContain(
      `package=${UPI_APPS.paytm.androidPackage}`
    );

    const bhimIntent = getAppUpiLink('bhim', config, { isAndroid: true, isIOS: false });
    expect(bhimIntent).toContain(
      `package=${UPI_APPS.bhim.androidPackage}`
    );
  });

  it('generates correct iOS app schemes', () => {
    const config = {
      upiId: 'urlive@slc',
      amount: 299,
    };

    const gpayIos = getAppUpiLink('gpay', config, { isAndroid: false, isIOS: true });
    expect(gpayIos.startsWith('gpay://upi/pay?')).toBe(true);
    expect(gpayIos).toContain('pa=urlive@slc');

    const phonepeIos = getAppUpiLink('phonepe', config, { isAndroid: false, isIOS: true });
    expect(phonepeIos.startsWith('phonepe://pay?')).toBe(true);

    const paytmIos = getAppUpiLink('paytm', config, { isAndroid: false, isIOS: true });
    expect(paytmIos.startsWith('paytmmp://pay?')).toBe(true);

    const bhimIos = getAppUpiLink('bhim', config, { isAndroid: false, isIOS: true });
    expect(bhimIos.startsWith('bhim://upi/pay?')).toBe(true);
  });

  it('returns standard upi://pay URI for generic/other apps', () => {
    const config = {
      upiId: 'urlive@slc',
      amount: 299,
    };

    const genericAndroid = getAppUpiLink('generic', config, { isAndroid: true, isIOS: false });
    expect(genericAndroid.startsWith('upi://pay?')).toBe(true);

    const genericIos = getAppUpiLink('generic', config, { isAndroid: false, isIOS: true });
    expect(genericIos.startsWith('upi://pay?')).toBe(true);
  });

  it('generates a valid QR code Data URL matching the exact standard UPI URI', async () => {
    const { generateUpiQrDataUrl } = await import('./upi');
    const jsQR = (await import('jsqr')).default;
    const { PNG } = await import('pngjs');

    const config = {
      upiId: 'urlive@slc',
      payeeName: 'UR LIVE',
      amount: 299,
      currency: 'INR',
      transactionNote: 'Premium Subscription',
    };

    const expectedUri = buildStandardUpiUri(config);
    const dataUrl = await generateUpiQrDataUrl(config, { width: 300 });

    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    // Decode back from base64 PNG using jsQR
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const png = PNG.sync.read(buffer);
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(expectedUri);
  });
});
