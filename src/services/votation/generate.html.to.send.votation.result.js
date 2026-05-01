const renderStatsToHTML = function(data, level = 1) {
  let html = '';
  
  // Caso base: valor primitivo
  if (typeof data !== "object" || data === null) {
    return String(data);
  }

  // Si es array
  if (Array.isArray(data)) {
    html += '<ul>';
    data.forEach(item => {
      html += `<li>${renderStatsToHTML(item, level + 1)}</li>`;
    });
    html += '</ul>';
    return html;
  }

  // Si es objeto
  html += '<div style="margin-left: 20px; margin-bottom: 10px;">';
  
  for (const key in data) {
    const value = data[key];
    
    // Formatear key (quitar _id, etc)
    const formattedKey = key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
    
    // Si es un objeto o array, mostrar con estilo especial
    if (typeof value === 'object' && value !== null) {
      html += `
        <div style="margin: 10px 0;">
          <strong style="color: #2c3e50; display: block; border-bottom: 1px solid #eee; padding-bottom: 5px;">
            ${formattedKey}:
          </strong>
          ${renderStatsToHTML(value, level + 1)}
        </div>
      `;
    } else {
      // Valores simples
      let displayValue = value;
      
      // Formatear porcentajes
      if (key.includes('percentage') && typeof value === 'number') {
        displayValue = `${value}%`;
      }
      
      html += `
        <div style="margin: 5px 0; display: flex;">
          <span style="width: 150px; color: #7f8c8d;">${formattedKey}:</span>
          <span style="font-weight: bold; color: #2980b9;">${displayValue}</span>
        </div>
      `;
    }
  }
  
  html += '</div>';
  return html;
};

// Uso:
const generateEmailHTML = (results) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        .stats-container { background: #f9f9f9; padding: 20px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <h1>📊 Resultados: ${results.data.subject}</h1>
      <div class="stats-container">
        ${renderStatsToHTML(results.data)}
      </div>
      <p style="text-align: center; color: #95a5a6; margin-top: 30px;">
        Reporte generado el ${new Date().toLocaleDateString()}
      </p>
    </body>
    </html>
  `;
};