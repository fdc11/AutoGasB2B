const AJUSTES_CATALOGO = {
  sedes: ['ICA', 'HUANCAYO', 'LIMA', 'NAZCA'],
  tipoConversion: ['GLP', 'GNV'],
  tipoTanqueGlp: [
    'TOROIDAL BRIDA INTERNA GLP',
    'TOROIDAL BRIDA EXTERNA GLP',
    'CILINDRICO GLP',
    'CILINDRICO GNV',
  ],
  bono: ['BONO 1 - FISE GASOLINA', 'BONO 2 - FISE GLP', 'SIN BONO'],
  marcaTanque: ['AMS', 'ATIKER', 'CY', 'FESA'],
  capacidadTanqueGnv: ['2GL', '3GL', '4GL', '5GL'],
  concesionarias: ['AUTONIZA', 'VARI', 'FOTON', 'WANKAMOTORS', 'OTROS'],
  estadoServicio: ['EN PROCESO', 'EN REVISION', 'FINALIZADO', 'ENTREGADO'],
  estadoPago: ['PENDIENTE', 'PAGADO PARCIAL', 'PAGADO'],
};

export async function getAjustes() {
  return structuredClone(AJUSTES_CATALOGO);
}

export function fillSelect(selectEl, values, placeholder = 'Selecciona...') {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  first.disabled = true;
  first.selected = true;
  selectEl.appendChild(first);

  values.forEach((value) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    selectEl.appendChild(opt);
  });
}
