// PDF export utility for reports - generates print-friendly A4 landscape tables
export function exportPDF(title: string, headers: string[], rows: string[][], filters?: Record<string, string>) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow pop-ups to export PDF'); return; }

  const filterHtml = filters
    ? `<div style="margin-bottom:12px;font-size:10px;color:#666">${Object.entries(filters).filter(([,v]) => v && v !== 'all').map(([k, v]) => `<span style="margin-right:16px"><b>${k}:</b> ${v}</span>`).join('')}</div>`
    : '';

  const thStyle = 'padding:4px 8px;border:1px solid #ddd;background:#f5f5f5;font-size:10px;text-align:left;white-space:nowrap;font-weight:600';
  const tdStyle = 'padding:3px 8px;border:1px solid #eee;font-size:10px;white-space:nowrap';

  const tableHtml = `
    <table style="border-collapse:collapse;width:100%">
      <thead><tr>${headers.map(h => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td style="${tdStyle}">${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;

  printWindow.document.write(`<!DOCTYPE html><html><head><title>${title} - fabriOS</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 16px; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 2px solid #333; padding-bottom: 8px; }
      .header h1 { font-size: 16px; margin: 0; }
      .header .brand { font-size: 10px; color: #999; }
      .header .date { font-size: 10px; color: #666; }
      .footer { margin-top: 16px; font-size: 9px; color: #999; text-align: center; }
    </style>
  </head><body>
    <div class="header">
      <div><h1>${title}</h1><span class="brand">fabriOS · Production OS for Print & Stitch</span></div>
      <span class="date">Generated: ${new Date().toLocaleString()}</span>
    </div>
    ${filterHtml}
    ${tableHtml}
    <div class="footer">fabriOS Report · Page 1</div>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  printWindow.document.close();
}
