import { useCallback, useEffect, useState } from 'react';
import { mastersFormApi } from '../masterKit/masterRecordsApi';
import { ACTIONS, FALLBACK_GROUPS, LEGACY, anyRight, fullRow, hasForms, leafKeys } from './userFormData';

const CATALOG_RETRY_MS = 15000;

const catalogError = (error) => {
  const { response } = error;
  if (response) return response.status === 404 ? 'backend not restarted (route users/modules missing)' : `HTTP ${response.status}`;
  return error.message || 'network error';
};

// the module catalog from the server; retried every 15 s while it is not loaded
function usePermissionCatalog() {
  const [catalog, setCatalog] = useState({ groups: FALLBACK_GROUPS, legacy: LEGACY, loaded: false, error: '' });

  const loadCatalog = useCallback(async () => {
    try {
      const answer = await mastersFormApi.userModuleCatalog();
      if (!answer?.groups) throw new Error('bad response');
      setCatalog({ groups: answer.groups, legacy: answer.legacy || {}, loaded: true, error: '' });
    } catch (error) {
      setCatalog((current) => ({ ...current, loaded: false, error: catalogError(error) }));
    }
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => {
    if (catalog.loaded) return undefined;
    const timer = setInterval(loadCatalog, CATALOG_RETRY_MS);
    return () => clearInterval(timer);
  }, [catalog.loaded, loadCatalog]);

  return { catalog, loadCatalog };
}

export default function usePermissions() {
  const { catalog, loadCatalog } = usePermissionCatalog();
  const [permissions, setPermissions] = useState({});
  const [openModules, setOpenModules] = useState({});

  const allModuleKeys = catalog.groups.flatMap((group) => group.modules.flatMap(leafKeys));
  const allModules = catalog.groups.flatMap((group) => group.modules);
  const permCount = allModules.filter((module) => leafKeys(module).some((key) => anyRight(permissions[key]))).length;
  const moduleTotal = allModules.length;

  const toggleOpen = (key) => setOpenModules((current) => ({ ...current, [key]: !current[key] }));
  const anyModuleOpen = Object.values(openModules).some(Boolean);
  const toggleAllForms = () => {
    const next = {};
    allModules.forEach((module) => {
      if (hasForms(module)) next[module.key] = !anyModuleOpen;
    });
    setOpenModules(next);
  };

  const setKeys = (keys, makeRow) => setPermissions((current) => {
    const next = { ...current };
    keys.forEach((key) => { next[key] = makeRow(next[key]); });
    return next;
  });

  const handleSelectAll = (isChecked) => setPermissions(Object.fromEntries(allModuleKeys.map((key) => [key, fullRow(isChecked)])));
  const handleColumnSelectAll = (field, isChecked) => setKeys(allModuleKeys, (row) => ({ ...(row || fullRow(false)), [field]: isChecked }));
  // one form / one module without forms: all four rights on / off
  const handleLeafAll = (key, isChecked) => setKeys([key], () => fullRow(isChecked));
  const handleModuleAll = (module, isChecked) => setKeys(leafKeys(module), () => fullRow(isChecked));
  // one module, one column: e.g. View on every form of Core Masters
  const handleModuleField = (module, field, isChecked) => setKeys(leafKeys(module), (row) => ({ ...(row || fullRow(false)), [field]: isChecked }));
  const handleGroupAll = (group, isChecked) => setKeys(group.modules.flatMap(leafKeys), () => fullRow(isChecked));
  const handlePermChange = (key, field, value) => setPermissions((current) => ({ ...current, [key]: { ...(current[key] || {}), [field]: value } }));

  const leafAllOn = (key) => ACTIONS.every((action) => permissions[key]?.[action]);
  const moduleAllOn = (module) => leafKeys(module).every(leafAllOn);
  const moduleAnyOn = (module) => leafKeys(module).some((key) => anyRight(permissions[key]));
  const moduleFieldOn = (module, field) => leafKeys(module).every((key) => permissions[key]?.[field]);
  const moduleFieldAny = (module, field) => leafKeys(module).some((key) => permissions[key]?.[field]);
  const groupAllOn = (group) => group.modules.length > 0 && group.modules.every(moduleAllOn);
  const groupAnyOn = (group) => group.modules.some(moduleAnyOn);
  const columnAllOn = (field) => allModuleKeys.length > 0 && allModuleKeys.every((key) => permissions[key]?.[field]);
  const allOn = allModuleKeys.length > 0 && allModuleKeys.every(leafAllOn);

  return {
    catalog, loadCatalog, permissions, setPermissions, permCount, moduleTotal,
    openModules, toggleOpen, anyModuleOpen, toggleAllForms,
    handleSelectAll, handleColumnSelectAll, handleLeafAll, handleModuleAll, handleModuleField, handleGroupAll, handlePermChange,
    leafAllOn, moduleAllOn, moduleAnyOn, moduleFieldOn, moduleFieldAny, groupAllOn, groupAnyOn, columnAllOn, allOn,
  };
}
