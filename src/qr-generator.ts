import QRCode from 'qrcode';

export async function generateQRCodeDataURL(uri: string): Promise<string> {
  try {
    const qrDataURL = await QRCode.toDataURL(uri, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 512,
      margin: 2,
    });
    return qrDataURL;
  } catch (error) {
    console.error('QR code generation error:', error);
    throw new Error('Failed to generate QR code');
  }
}

export async function generateQRCodeASCII(uri: string): Promise<string> {
  try {
    const qrASCII = await QRCode.toString(uri, {
      type: 'terminal',
      errorCorrectionLevel: 'L',
      small: true,
    });
    return qrASCII;
  } catch (error) {
    console.error('QR code ASCII generation error:', error);
    throw new Error('Failed to generate QR code ASCII');
  }
}
