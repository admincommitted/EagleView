// Two shapes of a container row: the SB Header > Container Details list (exportData.Containers: ContainerNumber ...)
// is the one shown and filed; the saved / file rows (containers: containerNo, size ...) are what the database keeps.

const hasContainerNo = (row) => row && (row.containerNo || row.ContainerNumber);

export const savedContainersWithNo = (list) => (list || []).filter(hasContainerNo);

export const toHeaderContainers = (list) => (Array.isArray(list) ? list : []).filter(hasContainerNo).map((row) => ({
  ContainerNumber: row.ContainerNumber || row.containerNo || '',
  ContainerSize: row.ContainerSize || row.size || '',
  ContainerType: row.ContainerType || row.type || '',
  ExciseSealNo: row.ExciseSealNo || row.exciseSealNo || row.sealNo || '',
  SealDate: row.SealDate || row.sealDate || '',
  SealTypeIndicator: row.SealTypeIndicator || row.sealType || '',
  SealDeviceID: row.SealDeviceID || row.deviceId || '',
  NoOfPktsStuffed: row.NoOfPktsStuffed || row.stuffedPkgs || '',
  VGM: row.VGM || row.vgmWeight || '',
  MovementDocumentType: row.MovementDocumentType || row.docType || '',
  MovementDocumentNumber: row.MovementDocumentNumber || row.docNo || '',
  EqmntType: row.EqmntType || row.eqmntType || '',
  EqmntQty: row.EqmntQty || row.eqmntQty || '',
  EqmntQtyCode: row.EqmntQtyCode || row.eqmntQtyCode || '',
}));

export const toSavedContainers = (headerRows) => headerRows.map((row) => ({
  containerNo: row.ContainerNumber || row.containerNo || '',
  size: row.ContainerSize || row.size || '20',
  type: row.ContainerType || row.type || '',
  sealNo: row.ExciseSealNo || row.sealNo || '',
  exciseSealNo: row.ExciseSealNo || row.exciseSealNo || '',
  sealDate: row.SealDate || row.sealDate || '',
  deviceId: row.SealDeviceID || row.deviceId || '',
  vgmWeight: row.VGM || row.vgmWeight || 0,
  stuffedPkgs: row.NoOfPktsStuffed || row.stuffedPkgs || 0,
  sealType: row.SealTypeIndicator || row.sealType || '',
  docType: row.MovementDocumentType || row.docType || '',
  docNo: row.MovementDocumentNumber || row.docNo || '',
  eqmntType: row.EqmntType || row.eqmntType || '',
  eqmntQty: row.EqmntQty || row.eqmntQty || '',
  eqmntQtyCode: row.EqmntQtyCode || row.eqmntQtyCode || '',
}));
