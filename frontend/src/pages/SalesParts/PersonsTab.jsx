// Sales > Sales persons: the sales team (role, reporting, branches, services, login, iCAFFE names), customers moved when one
// leaves, and the names written in iCAFFE (dockets, party masters, debtor groups) that are not a sales person yet.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRightLeft, Plus, Users } from 'lucide-react';
import { Button, DataTable, Modal } from '@/components/ui';
import { salesHubApi } from './salesApi';
import { dmy, labelsOf } from './salesFormat';
import { CheckLabel, Muted } from './salesWidgets';
import { MoveCustomersBox, PersonForm, UnmatchedNames } from './PersonForms';

function personColumns(meta, onOpen, onMove) {
  const roleLabels = labelsOf(meta.roles);
  const serviceLabels = labelsOf(meta.services);
  const servicesText = (codes) => String(codes || '').split(',').filter(Boolean).map((code) => serviceLabels[code] || code).join(', ');
  return [
    { key: 'code', header: 'Code' },
    {
      key: 'name',
      header: 'Name',
      className: 'tw:whitespace-normal',
      cell: (person) => (
        <>
          <Button variant="link" className="tw:h-auto tw:font-bold" onClick={() => onOpen(person)}>{person.name}</Button>
          {person.aliases && <Muted className="tw:text-[10.5px]">also {person.aliases.split(',').join(', ')}</Muted>}
          {person.isActive === 0 && <div className="tw:text-[10.5px] tw:text-destructive">left {dmy(person.leaveDate)}</div>}
        </>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (person) => <>{roleLabels[person.role] || person.role}{person.designation ? <Muted className="tw:text-[10.5px]">{person.designation}</Muted> : null}</>,
    },
    { key: 'reportingToName', header: 'Reports to', cell: (person) => person.reportingToName || '' },
    { key: 'branchCodes', header: 'Branches', cell: (person) => (person.branchCodes || '').split(',').join(', ') },
    { key: 'services', header: 'Services', className: 'tw:max-w-[220px] tw:whitespace-normal', cell: (person) => servicesText(person.services) },
    { key: 'loginName', header: 'Login', cell: (person) => person.loginName || <span className="tw:text-muted-foreground">-</span> },
    {
      key: 'mobile',
      header: 'Mobile / e-mail',
      cell: (person) => <>{person.mobile}{person.email && <Muted className="tw:text-[10.5px]">{person.email}</Muted>}</>,
    },
    { key: 'customers', header: 'Customers', align: 'right', cell: (person) => person.customers - person.prospects },
    { key: 'prospects', header: 'Prospects', align: 'right' },
    {
      key: 'move',
      header: '',
      cell: (person) => meta.canManage && person.customers > 0 && <Button variant="ghost" onClick={() => onMove(person)}><ArrowRightLeft /> Move customers</Button>,
    },
  ];
}

export default function PersonsTab({ meta, reloadMeta }) {
  const [persons, setPersons] = useState([]);
  const [users, setUsers] = useState([]);
  const [openPerson, setOpenPerson] = useState(null);
  const [showNames, setShowNames] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [movingFrom, setMovingFrom] = useState(null);

  const load = useCallback(async () => {
    try {
      setPersons((await salesHubApi.persons()).data);
    } catch (error) {
      toast.error(error.message);
    }
  }, []);

  const loadUsers = async () => {
    try {
      setUsers((await salesHubApi.users()).data);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => { load(); loadUsers(); }, [load]);

  const reloadAll = () => { load(); reloadMeta?.(); };
  const shown = persons.filter((person) => showLeft || person.isActive !== 0);

  return (
    <div>
      <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        {meta.canManage && <Button variant="default" onClick={() => setOpenPerson('new')}><Plus /> Sales person</Button>}
        <Button onClick={() => setShowNames(true)}><Users /> Names found in iCAFFE</Button>
        <div className="tw:ml-auto"><CheckLabel checked={showLeft} onCheckedChange={setShowLeft}>Show those who left</CheckLabel></div>
      </div>
      <DataTable
        columns={personColumns(meta, setOpenPerson, setMovingFrom)}
        rows={shown}
        rowClassName={(person) => (person.isActive === 0 ? 'tw:opacity-55' : undefined)}
        emptyText='No sales person yet. Add the team, or open "Names found in iCAFFE" and add the names already used there.'
        containerClassName="tw:rounded-md tw:border tw:border-border tw:bg-card"
      />
      {openPerson && (
        <PersonForm
          person={openPerson === 'new' ? null : openPerson}
          meta={meta}
          persons={persons}
          users={users}
          onClose={() => setOpenPerson(null)}
          onSaved={reloadAll}
        />
      )}
      <Modal open={showNames} title="Names found in iCAFFE" width={900} onClose={() => setShowNames(false)}>
        <UnmatchedNames meta={meta} persons={persons} onDone={reloadAll} />
      </Modal>
      <Modal open={Boolean(movingFrom)} title={movingFrom ? `Move the customers of ${movingFrom.name}` : ''} width={720} onClose={() => setMovingFrom(null)}>
        {movingFrom && (
          <>
            <Muted className="tw:text-entry">
              {movingFrom.customers} customer(s) / prospect(s) have {movingFrom.name} as KAM. Lost and blocked ones stay. The change is kept in each customer's KAM history.
            </Muted>
            <MoveCustomersBox from={movingFrom} persons={persons.filter((person) => person.id !== movingFrom.id)} onMoved={() => { setMovingFrom(null); reloadAll(); }} />
          </>
        )}
      </Modal>
    </div>
  );
}
