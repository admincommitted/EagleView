import { BellRing, Briefcase, CheckCircle, History, ShieldAlert } from 'lucide-react';
import { Button, Field, Input, Modal, SelectBox } from '@/components/ui';
import DailyReportWindow from './DailyReportWindow';

const ROLES = ['Fleet Driver', 'Doc Collection', 'Customs Clerk', 'Airport Runner', 'Other'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const AGENT_FIELDS = [
  { key: 'name', label: 'Full Name *', placeholder: '' },
  { key: 'phone', label: 'Phone Number *', placeholder: '+91 98765 43210' },
  { key: 'vehicleNumber', label: 'Vehicle Number', placeholder: 'DL 1C AA 1234' },
];

// sits on the theme-colour heading band of the window, so it is white on a translucent circle
function WindowTitle({ icon: Icon, title, subtitle }) {
  return (
    <span className="tw:flex tw:items-center tw:gap-3">
      <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-white/20"><Icon className="tw:size-5" /></span>
      <span className="tw:flex tw:flex-col">
        <span className="tw:text-[18px] tw:font-extrabold">{title}</span>
        {subtitle && <span className="tw:text-[13px] tw:font-semibold tw:opacity-85">{subtitle}</span>}
      </span>
    </span>
  );
}

const actions = (onCancel, okButton) => <><Button size="lg" onClick={onCancel}>Cancel</Button>{okButton}</>;

function HistoryWindow({ agent, history, onClose }) {
  return (
    <Modal
      open
      width={520}
      onClose={onClose}
      closeOnOutside={false}
      title={<span className="tw:flex tw:items-center tw:gap-2 tw:text-[18px] tw:font-extrabold"><History className="tw:size-[18px]" /> Location History</span>}
      description={`${agent?.name || ''} · Last 8 hours`}
      footer={<Button size="lg" variant="default" onClick={onClose}>Close</Button>}
    >
      {history.length === 0 ? (
        <div className="tw:py-10 tw:text-center tw:text-muted-foreground">No location history found for today.</div>
      ) : (
        <div className="tw:max-h-[320px] tw:overflow-y-auto">
          {history.slice().reverse().map((point, index) => (
            <div key={index} className="tw:flex tw:gap-3 tw:border-b tw:border-border/50 tw:py-2.5">
              <div className="tw:min-w-[80px] tw:text-[11px] tw:text-muted-foreground">{new Date(point.recordedAt).toLocaleTimeString()}</div>
              <div className="tw:text-[13px] tw:text-foreground">{point.locationName || `${point.lat?.toFixed(4)}, ${point.lng?.toFixed(4)}`}</div>
              {point.speed !== null && <div className="tw:ml-auto tw:text-[11px] tw:text-muted-foreground">{Math.round(point.speed)} km/h</div>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function AddAgentWindow({ agent, onChange, onAdd, onClose }) {
  return (
    <Modal
      open
      width={400}
      onClose={onClose}
      closeOnOutside={false}
      title={<span className="tw:text-[20px] tw:font-extrabold">Add New Agent</span>}
      footer={actions(onClose, <Button size="lg" variant="default" onClick={onAdd}>Add Agent</Button>)}
    >
      {AGENT_FIELDS.map((field) => (
        <Field key={field.key} layout="col" label={field.label}>
          <Input data-allow-text placeholder={field.placeholder} value={agent[field.key]} onChange={(event) => onChange({ ...agent, [field.key]: event.target.value })} />
        </Field>
      ))}
      <Field layout="col" label="Role">
        <SelectBox value={agent.role} onValueChange={(role) => onChange({ ...agent, role })} options={ROLES} />
      </Field>
    </Modal>
  );
}

function DispatchWindow({ agents, dispatch, onChange, onDispatch, onClose }) {
  return (
    <Modal
      open
      width={480}
      onClose={onClose}
      closeOnOutside={false}
      title={<WindowTitle icon={Briefcase} title="Global Dispatch" />}
      footer={actions(onClose, <Button size="lg" variant="default" onClick={onDispatch}>Dispatch Task</Button>)}
    >
      <Field layout="col" label="Select Agent *">
        <SelectBox
          clearable
          clearLabel="-- Choose Agent --"
          placeholder="-- Choose Agent --"
          value={dispatch.agentId}
          onValueChange={(agentId) => onChange({ ...dispatch, agentId })}
          options={agents.map((agent) => ({ value: String(agent.id), label: `${agent.name} (${agent.role})` }))}
        />
      </Field>
      <Field layout="col" label="Task Title *">
        <Input data-allow-text value={dispatch.title} onChange={(event) => onChange({ ...dispatch, title: event.target.value })} />
      </Field>
      <Field layout="col" label="Location / Destination">
        <Input data-allow-text value={dispatch.location} onChange={(event) => onChange({ ...dispatch, location: event.target.value })} />
      </Field>
    </Modal>
  );
}

function AssignTaskWindow({ agent, task, onChange, onAssign, onClose }) {
  return (
    <Modal
      open
      width={480}
      onClose={onClose}
      closeOnOutside={false}
      title={<WindowTitle icon={Briefcase} title="Assign Task" subtitle={`Agent: ${agent?.name || ''}`} />}
      footer={actions(onClose, <Button size="lg" variant="default" onClick={onAssign}><CheckCircle /> Assign Now</Button>)}
    >
      <Field layout="col" label="Task Title *">
        <Input data-allow-text placeholder="e.g. Deliver LCL Cargo to Okhla" value={task.title} onChange={(event) => onChange({ ...task, title: event.target.value })} />
      </Field>
      <Field layout="col" label="Location (Optional)">
        <Input data-allow-text placeholder="e.g. Connaught Place" value={task.location} onChange={(event) => onChange({ ...task, location: event.target.value })} />
      </Field>
      <Field layout="col" label="Priority">
        <SelectBox value={task.priority} onValueChange={(priority) => onChange({ ...task, priority })} options={PRIORITIES} />
      </Field>
    </Modal>
  );
}

function SirenWindow({ agent, message, onChange, onSend, onClose }) {
  return (
    <Modal
      open
      width={480}
      onClose={onClose}
      closeOnOutside={false}
      title={<WindowTitle icon={ShieldAlert} title="Emergency Siren" subtitle={`Target: ${agent?.name || ''}`} />}
      footer={actions(onClose, <Button size="lg" variant="destructive" onClick={onSend}><BellRing /> Send Alert Now</Button>)}
    >
      <div className="tw:rounded-lg tw:border-l-4 tw:border-destructive tw:bg-page tw:p-4">
        <p className="tw:m-0 tw:text-[14px] tw:leading-relaxed tw:font-medium tw:text-foreground">This action sends an emergency alert notification to the agent's device.</p>
      </div>
      <Field layout="col" label="Message to display">
        <Input data-allow-text className="tw:h-9 tw:text-[15px]" value={message} onChange={(event) => onChange(event.target.value)} />
      </Field>
    </Modal>
  );
}

export default function DashboardWindows({ dashboard }) {
  const { openWindow, setOpenWindow, selectedAgent } = dashboard;
  const close = () => setOpenWindow(null);

  if (openWindow === 'history') return <HistoryWindow agent={selectedAgent} history={dashboard.locationHistory} onClose={dashboard.closeHistory} />;
  if (openWindow === 'addAgent') return <AddAgentWindow agent={dashboard.newAgentData} onChange={dashboard.setNewAgentData} onAdd={dashboard.handleAddAgent} onClose={close} />;
  if (openWindow === 'dispatch') {
    return <DispatchWindow agents={dashboard.agents} dispatch={dashboard.dispatchData} onChange={dashboard.setDispatchData} onDispatch={dashboard.handleGlobalDispatch} onClose={close} />;
  }
  if (openWindow === 'task') return <AssignTaskWindow agent={selectedAgent} task={dashboard.newTask} onChange={dashboard.setNewTask} onAssign={dashboard.handleAssignTask} onClose={close} />;
  if (openWindow === 'siren') return <SirenWindow agent={selectedAgent} message={dashboard.sirenMessage} onChange={dashboard.setSirenMessage} onSend={dashboard.handlePingSiren} onClose={close} />;
  if (openWindow === 'report') {
    return (
      <DailyReportWindow
        reportDate={dashboard.reportDate}
        onDateChange={dashboard.setReportDate}
        reportData={dashboard.reportData}
        reportLoading={dashboard.reportLoading}
        onGenerate={dashboard.fetchReport}
        onClose={close}
      />
    );
  }
  return null;
}
