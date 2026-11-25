import { useCallback, useEffect, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import toast from 'react-hot-toast';
import { getToken } from '@/services/session';
import { fieldTrackingApi } from './fieldTrackingApi';
import { formatLastSeen, fromServerAgent } from './agentStatus';

const EMPTY_TASK = { title: '', location: '', priority: 'Normal' };
const EMPTY_DISPATCH = { agentId: '', title: '', location: '', priority: 'Normal' };
const EMPTY_AGENT = { name: '', role: 'Fleet Driver', phone: '', vehicleNumber: '' };
const REPLAY_STEP_MS = 400;
const OFFLINE_ALERT_PAUSE_MS = 5 * 60 * 1000;
const PRIORITY_EMOJI = { Urgent: '🔴', High: '🟠', Normal: '🔵', Low: '🟢' };

const wait = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

// live agent list (socket.io pings), the selected agent, the windows and their forms
export default function useFieldTracking() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationHistory, setLocationHistory] = useState([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [openWindow, setOpenWindow] = useState(null);

  const [sirenMessage, setSirenMessage] = useState('URGENT: Call Operations immediately!');
  const [newTask, setNewTask] = useState(EMPTY_TASK);
  const [dispatchData, setDispatchData] = useState(EMPTY_DISPATCH);
  const [newAgentData, setNewAgentData] = useState(EMPTY_AGENT);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const answer = await fieldTrackingApi.agents();
      if (answer.success) setAgents(answer.data.map(fromServerAgent));
    } catch (error) {
      toast.error('Failed to load agents: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const socket = socketIO(window.location.origin, { transports: ['websocket', 'polling'], auth: { token: getToken() || '' } });

    socket.on('agent_location_update', ({ agentId, lat, lng, speed, battery, locationName, lastSeen }) => {
      setAgents((current) => current.map((agent) => {
        if (agent.id !== agentId) return agent;
        const updated = {
          ...agent,
          lat,
          lng,
          location: locationName || agent.location,
          speed: speed || agent.speed,
          battery: battery !== undefined ? battery : agent.battery,
          lastSeen: formatLastSeen(lastSeen),
          status: 'In Transit',
        };
        setSelectedAgent((selected) => (selected?.id === agentId ? { ...selected, ...updated } : selected));
        return updated;
      }));
    });

    socket.on('agent_task_updated', ({ agentId, task }) => {
      setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, task, taskStatus: 'Pending', status: 'In Transit' } : agent)));
    });

    socket.on('agent_status_updated', ({ agentId, status }) => {
      setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, status } : agent)));
    });

    socket.on('agent_added', (newAgent) => {
      setAgents((current) => [...current, {
        ...newAgent, lat: newAgent.currentLat, lng: newAgent.currentLng, location: newAgent.currentLocation, task: newAgent.currentTask, lastSeen: 'Just now',
      }]);
      toast.success(`New agent ${newAgent.name} added!`);
    });

    socket.on('agent_removed', ({ agentId }) => {
      setAgents((current) => current.filter((agent) => agent.id !== agentId));
      setSelectedAgent((selected) => (selected?.id === agentId ? null : selected));
    });

    socket.on('siren_triggered', ({ agentName, message }) => {
      toast(`🚨 Siren sent to ${agentName}: "${message}"`, { duration: 5000 });
    });

    // a field boy reported a task himself
    socket.on('self_task_reported', ({ agentName, task, priority, location }) => {
      const priorityEmoji = PRIORITY_EMOJI[priority] || '🔵';
      toast(`${priorityEmoji} ${agentName} reported a task: "${task}" — ${location || 'Field'}`, {
        duration: 8000,
        style: {
          background: priority === 'Urgent' ? '#7f1d1d' : priority === 'High' ? '#78350f' : '#1e3a5f',
          color: 'white',
          fontWeight: '700',
          border: `1px solid ${priority === 'Urgent' ? '#ef4444' : priority === 'High' ? '#f59e0b' : '#0ea5e9'}`,
        },
        icon: priorityEmoji,
      });
    });

    socket.on('task_completed', ({ agentId, agentName, completedTask }) => {
      toast.success(`✅ ${agentName} completed a task: "${completedTask}"`, { duration: 6000 });
      setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, taskStatus: 'Done', status: 'Idle' } : agent)));
    });

    // no ping for 5+ minutes; one alert per agent every 5 minutes
    socket.on('agent_offline_alert', ({ agentId, agentName, minutesSince }) => {
      const alertKey = `offline_alerted_${agentId}`;
      if (Date.now() - (window[alertKey] || 0) < OFFLINE_ALERT_PAUSE_MS) return;
      window[alertKey] = Date.now();
      toast(`⚠️ ${agentName} — no ping for ${minutesSince} min - please check`, {
        duration: 10000,
        style: { background: '#78350f', color: 'white', fontWeight: '700', border: '1px solid #f59e0b' },
        icon: '⚠️',
      });
      setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, isStale: true } : agent)));
    });

    return () => socket.disconnect();
  }, [fetchAgents]);

  const fetchReport = async () => {
    setReportLoading(true);
    setReportData(null);
    try {
      const answer = await fieldTrackingApi.dailyReport(reportDate);
      setReportData(answer.data);
    } catch (error) {
      toast.error('Could not load the report: ' + error.message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleRouteReplay = async () => {
    if (!selectedAgent) return;
    if (isReplaying) { toast('Replay is already running...'); return; }
    let history = locationHistory;
    if (!history.length) {
      try {
        const answer = await fieldTrackingApi.history(selectedAgent.id);
        history = answer.data || [];
        setLocationHistory(history);
      } catch {
        toast.error('Could not load the location history');
        return;
      }
    }
    if (!history.length) { toast.error('No location history found'); return; }

    setIsReplaying(true);
    toast('▶️ Route replay shuru...', { duration: 2000 });
    for (const point of history) {
      setAgents((current) => current.map((agent) => (agent.id === selectedAgent.id ? { ...agent, lat: point.lat, lng: point.lng } : agent)));
      await wait(REPLAY_STEP_MS);
    }
    setIsReplaying(false);
    toast.success('✅ Replay complete');
    fetchAgents();
  };

  // toast.promise shows the progress, the success and the server's refusal
  const sendWithToast = async (call, messages) => {
    try {
      await toast.promise(call(), { ...messages, error: (error) => error.message });
      return true;
    } catch {
      return false;
    }
  };

  const handleAssignTask = async () => {
    if (!newTask.title) { toast.error('Please enter a task title'); return; }
    const sent = await sendWithToast(
      () => fieldTrackingApi.assignTask({ agentId: selectedAgent.id, task: newTask.title, location: newTask.location, priority: newTask.priority }),
      { loading: `Assigning task to ${selectedAgent?.name}...`, success: 'Task assigned!' },
    );
    if (!sent) return;
    setOpenWindow(null);
    setNewTask(EMPTY_TASK);
  };

  const handleGlobalDispatch = async () => {
    if (!dispatchData.title || !dispatchData.agentId) { toast.error('Select agent and enter task'); return; }
    const sent = await sendWithToast(
      () => fieldTrackingApi.assignTask({ agentId: dispatchData.agentId, task: dispatchData.title, location: dispatchData.location, priority: dispatchData.priority }),
      { loading: 'Dispatching...', success: 'Task dispatched!' },
    );
    if (!sent) return;
    setOpenWindow(null);
    setDispatchData(EMPTY_DISPATCH);
  };

  const handleAddAgent = async () => {
    if (!newAgentData.name || !newAgentData.phone) { toast.error('Name and phone required'); return; }
    const sent = await sendWithToast(() => fieldTrackingApi.addAgent(newAgentData), { loading: 'Adding agent...', success: 'Agent added!' });
    if (!sent) return;
    setOpenWindow(null);
    setNewAgentData(EMPTY_AGENT);
  };

  const handlePingSiren = async () => {
    const sent = await sendWithToast(
      () => fieldTrackingApi.siren({ agentId: selectedAgent.id, message: sirenMessage }),
      { loading: `Pinging ${selectedAgent?.name}...`, success: `Emergency siren sent to ${selectedAgent?.name}!` },
    );
    if (sent) setOpenWindow(null);
  };

  const handleViewHistory = async () => {
    if (!selectedAgent) return;
    try {
      const answer = await fieldTrackingApi.history(selectedAgent.id, 8);
      setLocationHistory(answer.data || []);
      setOpenWindow('history');
    } catch (error) {
      toast.error('Could not load history: ' + error.message);
    }
  };

  const markTaskDone = async () => {
    await toast.promise(fieldTrackingApi.completeTask(selectedAgent.id), { loading: 'Marking done…', success: '✅ Task complete!', error: (error) => error.message });
    setAgents((current) => current.map((agent) => (agent.id === selectedAgent.id ? { ...agent, taskStatus: 'Done', status: 'Idle' } : agent)));
  };

  const closeHistory = () => { setOpenWindow(null); setLocationHistory([]); };

  const query = searchQuery.toLowerCase();
  const filteredAgents = agents.filter((agent) => agent.name?.toLowerCase().includes(query) || agent.role?.toLowerCase().includes(query));

  return {
    agents, loading, selectedAgent, setSelectedAgent, searchQuery, setSearchQuery, filteredAgents, locationHistory, isReplaying, fetchAgents,
    openWindow, setOpenWindow, closeHistory,
    sirenMessage, setSirenMessage, newTask, setNewTask, dispatchData, setDispatchData, newAgentData, setNewAgentData,
    reportDate, setReportDate, reportData, reportLoading,
    fetchReport, handleRouteReplay, handleAssignTask, handleGlobalDispatch, handleAddAgent, handlePingSiren, handleViewHistory, markTaskDone,
  };
}
