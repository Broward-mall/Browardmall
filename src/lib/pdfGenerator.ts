import PDFDocument from 'pdfkit';

export function generateStorePDF(storeData: {
  ownerName: string;
  storeName: string;
  trackingCode: string;
  mallName: string;
  purchaseDate: string;
  expiryDate: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Design certificate board
      doc.rect(20, 20, 762, 515).lineWidth(3).stroke('#2563EB'); // Deep blue border
      doc.rect(26, 26, 750, 503).lineWidth(1).stroke('#E2E8F0'); // Inner border

      // Title header
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#0F172A').text('CERTIFICATE OF ACQUISITION', 40, 80, { align: 'center' });
      doc.fontSize(12).font('Helvetica').fillColor('#475569').text('BROWARD MALL COMMERCIAL SPACE REGISTRY', 40, 120, { align: 'center' });

      doc.moveDown(2);

      // Certification body
      doc.fontSize(14).font('Helvetica').fillColor('#475569').text('This hereby certifies that', 40, 160, { align: 'center' });
      
      doc.moveDown(0.5);
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#2563EB').text(storeData.ownerName, 40, 190, { align: 'center' });
      
      doc.moveDown(0.8);
      doc.fontSize(13).font('Helvetica').fillColor('#475569').text('is the registered tenant and leasehold owner of the following commercial space asset:', 40, 235, { align: 'center' });

      // Grid specifications
      const specY = 280;
      const col1LabelX = 180;
      const col1ValueX = 380;

      const drawSpecRow = (label: string, val: string, yPos: number) => {
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text(label, col1LabelX, yPos);
        doc.fontSize(11).font('Helvetica').fillColor('#475569').text(val, col1ValueX, yPos);
      };

      drawSpecRow('Retail Suite Asset:', storeData.storeName, specY);
      drawSpecRow('Asset Tracking Code:', storeData.trackingCode, specY + 25);
      drawSpecRow('Mall Enterprise Complex:', storeData.mallName, specY + 50);
      drawSpecRow('Lease Acquisition Date:', storeData.purchaseDate || 'N/A', specY + 75);
      drawSpecRow('Lease Expiration Date:', storeData.expiryDate || 'N/A', specY + 100);

      // Footer Signatures
      doc.moveTo(150, 460).lineTo(350, 460).lineWidth(1).stroke('#CBD5E1');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text('Broward Mall Leasing Commission', 150, 468, { width: 200, align: 'center' });

      doc.moveTo(450, 460).lineTo(650, 460).lineWidth(1).stroke('#CBD5E1');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text('Registry Verification Office', 450, 468, { width: 200, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
