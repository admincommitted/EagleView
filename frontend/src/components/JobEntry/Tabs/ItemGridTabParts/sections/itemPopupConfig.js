export const uqcCombo = (masters) => ({
  kind: 'combo', options: masters.uqcs || [], getOptionValue: (uqc) => uqc.uqcCode, getOptionLabel: (uqc) => uqc.description,
});

export const textColumns = (headers) => Object.entries(headers).map(([key, header]) => ({ key, header }));
