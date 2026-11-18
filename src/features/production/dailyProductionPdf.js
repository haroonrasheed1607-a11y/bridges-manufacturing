import { formatDate } from '../../utils/dates.js';

export async function downloadDailyProductionPdf(date, rows) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
  const left = 42;
  const right = 570;
  let y;

  function heading() {
    pdf.setFont('helvetica', 'bold').setFontSize(18);
    pdf.text('Shop Floor Daily Production', left, 54);
    pdf.setFont('helvetica', 'normal').setFontSize(10);
    pdf.text(formatDate(date) + '  |  Tulsa local time', left, 73);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Order / item code', left, 104);
    pdf.text('Completed quantity', right, 104, { align: 'right' });
    pdf.line(left, 112, right, 112);
    pdf.setFont('helvetica', 'normal');
    y = 129;
  }

  heading();
  if (!rows.length) {
    pdf.text('No approved orders or completed quantities for this day.', left, y);
    y += 24;
  }

  for (const row of rows) {
    const label = [row.title || row.id, row.code].filter(Boolean).join(' / ');
    const lines = pdf.splitTextToSize(label, 340);
    const quantity = Number(row.pieces).toLocaleString('en-US') +
      (row.billableMode ? ' billable units' : ' legacy pieces');
    const height = Math.max(22, lines.length * 12 + 9);
    if (y + height > 730) {
      pdf.addPage();
      heading();
    }
    pdf.text(lines, left, y);
    pdf.text(quantity, right, y, { align: 'right' });
    y += height;
  }

  if (y > 700) { pdf.addPage(); heading(); }
  pdf.text('Verified by: ________________________    Date: ______________', left, y + 22);
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.text('Page ' + page + ' of ' + pdf.getNumberOfPages(), right, 758, { align: 'right' });
  }
  pdf.save('shop-floor-production-' + date + '.pdf');
}
