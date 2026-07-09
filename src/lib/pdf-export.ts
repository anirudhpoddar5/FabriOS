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

export function printDetailPage(title: string, sections: { label: string; value: string }[], tables: { title: string; headers: string[]; rows: (string | number | null)[][] }[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow pop-ups to print'); return; }

  const sectionHtml = sections
    .map(s => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:11px"><span style="color:#666">${s.label}</span><span style="font-weight:500">${s.value || '—'}</span></div>`)
    .join('');

  const thStyle = 'padding:5px 8px;border:1px solid #ddd;background:#f5f5f5;font-size:10px;text-align:left;white-space:nowrap;font-weight:600';
  const tdStyle = 'padding:4px 8px;border:1px solid #eee;font-size:10px;white-space:nowrap';

  const tablesHtml = tables
    .map(t => `
      <h3 style="font-size:12px;margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid #ddd">${t.title}</h3>
      <table style="border-collapse:collapse;width:100%;margin-bottom:12px">
        <thead><tr>${t.headers.map(h => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead>
        <tbody>${t.rows.map(r => `<tr>${r.map(c => `<td style="${tdStyle}">${c ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`)
    .join('');

  printWindow.document.write(`<!DOCTYPE html><html><head><title>${title} - fabriOS</title>
    <style>
      @page { size: A4 portrait; margin: 12mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; color: #333; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
      .header h1 { font-size: 18px; margin: 0; }
      .header .meta { font-size: 10px; color: #999; text-align:right; }
      .section { background:#fafafa; border:1px solid #eee; border-radius:4px; padding:8px 12px; margin-bottom:12px; }
      .badge { display:inline-block; padding:1px 6px; border-radius:3px; font-size:9px; font-weight:600; border:1px solid #ddd; background:#f5f5f5; }
      .footer { margin-top: 20px; font-size: 9px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 8px; }
    </style>
  </head><body>
    <div class="header">
      <h1>${title}</h1>
      <div class="meta">${new Date().toLocaleString()}<br><span style="color:#999">fabriOS</span></div>
    </div>
    <div class="section">${sectionHtml}</div>
    ${tablesHtml}
    <div class="footer">fabriOS · Production OS for Print &amp; Stitch</div>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  printWindow.document.close();
}
