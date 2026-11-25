import { useEffect, useState } from 'react';
import { Plus, Settings, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';
import { askConfirm } from '@/components/common/askConfirm';
import { mastersApi, succeeded } from './MastersParts/mastersApi';
import PageHeader from './PurchaseParts/PageHeader';
import { DEPT_CODE, defaultYear, EMPTY_RULE, ruleBody, ruleProblem } from './DocumentSeriesParts/documentSeries';
import SeriesRuleForm from './DocumentSeriesParts/SeriesRuleForm';
import SeriesRulesTable from './DocumentSeriesParts/SeriesRulesTable';

/*
 * Numbering rules for invoices, vouchers and notes (table DocumentSeries). Branches and years come from the Company
 * Branch and Financial Year masters. Job numbers are not set here: they come from Settings > Sequence Config.
 */
export default function DocumentSeriesMaster() {
  const [rules, setRules] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [depts, setDepts] = useState(Object.keys(DEPT_CODE));
  const [branches, setBranches] = useState([]);
  const [years, setYears] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(EMPTY_RULE);
  const [branchFilter, setBranchFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRules = async () => {
    try {
      const body = await succeeded(mastersApi.documentSeries, 'Could not load numbering rules');
      setRules(body.data || []);
      if (Array.isArray(body.docTypes)) setDocTypes(body.docTypes);
      if (Array.isArray(body.depts)) setDepts(body.depts);
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setBranches((await mastersApi.companyBranches()).filter((branch) => branch.status !== 'Inactive'));
      } catch {
        // the branch list stays empty: rules can still be made for ALL branches
      }
    };
    const loadYears = async () => {
      try {
        const openYears = (await mastersApi.financialYears()).filter((year) => year.isActive !== false && !year.isDeleted);
        setYears(openYears);
        const year = defaultYear(openYears);
        if (year) setFormData((current) => (current.fyCode ? current : { ...current, fyCode: year.code }));
      } catch {
        // no year list: the year has to be picked once it loads
      }
    };
    loadRules();
    loadBranches();
    loadYears();
  }, []);

  const setField = (name, value) => setFormData((current) => ({ ...current, [name]: value }));

  const startNew = () => {
    setFormData({ ...EMPTY_RULE, fyCode: defaultYear(years)?.code || '' });
    setIsEditing(true);
  };

  const startEdit = (rule) => {
    setFormData({ ...EMPTY_RULE, ...rule });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveRule = async () => {
    const problem = ruleProblem(formData);
    if (problem) {
      toast.error(problem);
      return;
    }
    const nextNumber = parseInt(formData.nextNumber, 10);
    const savedRule = rules.find((rule) => rule.id === formData.id);
    const goesBack = Boolean(savedRule && nextNumber < savedRule.nextNumber);
    if (goesBack) {
      const goAhead = await askConfirm({
        title: 'Next number goes back',
        message: `Next number goes back from ${savedRule.nextNumber} to ${nextNumber}. Numbers already given may repeat. Continue?`,
        tone: 'warn',
      });
      if (!goAhead) return;
    }
    setSaving(true);
    try {
      await succeeded(() => mastersApi.saveDocumentSeries(formData.id, ruleBody(formData, goesBack)), 'Save failed');
      toast.success('Series rule saved successfully!');
      setIsEditing(false);
      loadRules();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (rule) => {
    const goAhead = await askConfirm({
      title: 'Delete numbering rule',
      message: `Delete the ${rule.docType} rule (${rule.branchCode} / ${rule.dept} / ${rule.fyCode})?`,
      okLabel: 'Delete',
      tone: 'danger',
    });
    if (!goAhead) return;
    try {
      await succeeded(() => mastersApi.deleteDocumentSeries(rule.id), 'Delete failed');
      toast.success('Rule deleted');
      if (formData.id === rule.id) setIsEditing(false);
      loadRules();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const shownRules = rules.filter((rule) => !branchFilter || rule.branchCode === branchFilter);

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[1400px] tw:flex-col tw:gap-6 tw:p-3 tw:md:p-6">
      <PageHeader
        icon={Settings}
        title="Document Series & Numbering Master"
        subtitle={(
          <>
            Numbering rules for invoices, vouchers and notes per branch, department and financial year. Job numbers:{' '}
            <a href="/settings?tab=sequence" className="tw:text-primary">Sequence Config</a>.
          </>
        )}
        actions={(
          <Button variant={isEditing ? 'secondary' : 'default'} size="lg" onClick={() => (isEditing ? setIsEditing(false) : startNew())}>
            {isEditing ? <><X /> Close</> : <><Plus /> New Series Rule</>}
          </Button>
        )}
      />

      {isEditing && (
        <SeriesRuleForm
          rule={formData}
          onChange={setField}
          docTypes={docTypes}
          branches={branches}
          depts={depts}
          years={years}
          saving={saving}
          onSave={saveRule}
        />
      )}

      <SeriesRulesTable
        rules={shownRules}
        branches={branches}
        branchFilter={branchFilter}
        onBranchFilterChange={setBranchFilter}
        onEdit={startEdit}
        onDelete={deleteRule}
      />
    </div>
  );
}
