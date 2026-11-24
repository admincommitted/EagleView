// State and logic
// Split out of FieldTrackingDashboard.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import L from 'leaflet';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io as socketIO } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useMap } from 'react-leaflet';
import { apiFetch, formatLastSeen } from './helpers';

export default function useFieldTrackingDashboard(ctx) {
  const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [locationHistory, setLocationHistory] = useState([]);

    // Modal States
    const [sirenModal, setSirenModal] = useState(false);
    const [sirenMsg, setSirenMsg] = useState('URGENT: Call Operations immediately!');
    const [taskModal, setTaskModal] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', location: '', priority: 'Normal' });
    const [dispatchModal, setDispatchModal] = useState(false);
    const [dispatchData, setDispatchData] = useState({ agentId: '', title: '', location: '', priority: 'Normal' });
    const [addAgentModal, setAddAgentModal] = useState(false);
    const [newAgentData, setNewAgentData] = useState({ name: '', role: 'Fleet Driver', phone: '', vehicleNumber: '' });
    const [historyModal, setHistoryModal] = useState(false);

    // Report Modal
    const [reportModal, setReportModal] = useState(false);
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);

    // Route Replay
    const [isReplaying, setIsReplaying] = useState(false);

    const socketRef = useRef(null);

    // ─── FETCH ALL AGENTS ──────────────────────────────────────────────────────
    const fetchAgents = useCallback(async () => {
        try {
            const res = await apiFetch('/agents');
            if (res.success) {
                setAgents(res.data.map(a => ({
                    ...a,
                    lat: a.currentLat,
                    lng: a.currentLng,
                    location: a.currentLocation,
                    battery: a.battery ?? 100,
                    speed: a.speed ?? '0 km/h',
                    task: a.currentTask ?? 'None',
                    lastSeen: a.lastSeenText ?? formatLastSeen(a.lastSeen)
                })));
            }
        } catch (err) {
            toast.error('Failed to load agents: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── SOCKET.IO LIVE UPDATES ────────────────────────────────────────────────
    useEffect(() => {
        fetchAgents();

        // Connect to socket server
        const socket = socketIO(window.location.origin, { transports: ['websocket', 'polling'], auth: { token: localStorage.getItem('token') || '' } }); // 14-Nov-2026: login needed
        socketRef.current = socket;

        // Live location ping from agent's mobile device
        socket.on('agent_location_update', ({ agentId, lat, lng, speed, battery, locationName, lastSeen }) => {
            setAgents(prev => prev.map(a => {
                if (a.id !== agentId) return a;
                const updated = {
                    ...a,
                    lat, lng,
                    location: locationName || a.location,
                    speed: speed || a.speed,
                    battery: battery !== undefined ? battery : a.battery,
                    lastSeen: formatLastSeen(lastSeen),
                    status: 'In Transit'
                };
                // If this agent is selected, keep selectedAgent in sync too
                setSelectedAgent(sel => sel?.id === agentId ? { ...sel, ...updated } : sel);
                return updated;
            }));
        });

        // Task assigned to agent
        socket.on('agent_task_updated', ({ agentId, task }) => {
            setAgents(prev => prev.map(a =>
                a.id === agentId ? { ...a, task, taskStatus: 'Pending', status: 'In Transit' } : a
            ));
        });

        // Status change broadcast
        socket.on('agent_status_updated', ({ agentId, status }) => {
            setAgents(prev => prev.map(a => a.id === agentId ? { ...a, status } : a));
        });

        // New agent added by another admin session
        socket.on('agent_added', (newAgent) => {
            setAgents(prev => [...prev, {
                ...newAgent,
                lat: newAgent.currentLat,
                lng: newAgent.currentLng,
                location: newAgent.currentLocation,
                task: newAgent.currentTask,
                lastSeen: 'Just now'
            }]);
            toast.success(`New agent ${newAgent.name} added!`);
        });

        // Agent removed
        socket.on('agent_removed', ({ agentId }) => {
            setAgents(prev => prev.filter(a => a.id !== agentId));
            setSelectedAgent(sel => sel?.id === agentId ? null : sel);
        });

        // Siren confirmation
        socket.on('siren_triggered', ({ agentName, message }) => {
            toast(`🚨 Siren sent to ${agentName}: "${message}"`, { duration: 5000 });
        });

        // Field boy ne khud task report kiya
        socket.on('self_task_reported', ({ agentName, task, priority, location }) => {
            const priorityEmoji = { Urgent: '🔴', High: '🟠', Normal: '🔵', Low: '🟢' }[priority] || '🔵';
            toast(`${priorityEmoji} ${agentName} reported a task: "${task}" — ${location || 'Field'}`, {
                duration: 8000,
                style: {
                    background: priority === 'Urgent' ? '#7f1d1d' : priority === 'High' ? '#78350f' : '#1e3a5f',
                    color: 'white', fontWeight: '700',
                    border: `1px solid ${priority === 'Urgent' ? '#ef4444' : priority === 'High' ? '#f59e0b' : '#0ea5e9'}`
                },
                icon: priorityEmoji,
            });
        });

        // Field boy ne task complete kiya
        socket.on('task_completed', ({ agentId, agentName, completedTask }) => {
            toast.success(`✅ ${agentName} completed a task: "${completedTask}"`, { duration: 6000 });
            setAgents(prev => prev.map(a =>
                a.id === agentId ? { ...a, taskStatus: 'Done', status: 'Idle' } : a
            ));
        });

        // Offline agent alert — 5+ min se ping nahi aayi
        socket.on('agent_offline_alert', ({ agentId, agentName, minutesSince }) => {
            const alertKey = `offline_alerted_${agentId}`;
            const lastAlert = window[alertKey] || 0;
            if (Date.now() - lastAlert < 5 * 60 * 1000) return; // debounce 5 min
            window[alertKey] = Date.now();
            toast(`⚠️ ${agentName} — no ping for ${minutesSince} min - please check`, {
                duration: 10000,
                style: { background: '#78350f', color: 'white', fontWeight: '700', border: '1px solid #f59e0b' },
                icon: '⚠️',
            });
            setAgents(prev => prev.map(a => a.id === agentId ? { ...a, isStale: true } : a));
        });

        return () => socket.disconnect();

    }, [fetchAgents]);

    // ─── FETCH DAILY REPORT ────────────────────────────────────────────────────
    const fetchReport = async () => {
        setReportLoading(true);
        setReportData(null);
        try {
            const res = await apiFetch(`/report/summary?date=${reportDate}`);
            setReportData(res.data);
        } catch(e) {
            toast.error('Could not load the report: ' + e.message);
        } finally {
            setReportLoading(false);
        }
    };

    // ─── ROUTE REPLAY ─────────────────────────────────────────────────────────
    const handleRouteReplay = async () => {
        if (!selectedAgent) return;
        if (isReplaying) { toast('Replay is already running...'); return; }
        let history = locationHistory;
        if (!history.length) {
            try {
                const res = await apiFetch(`/history/${selectedAgent.id}`);
                history = res.data || [];
                setLocationHistory(history);
            } catch(e) { toast.error('Could not load the location history'); return; }
        }
        if (!history.length) { toast.error('No location history found'); return; }

        setIsReplaying(true);
        toast('▶️ Route replay shuru...', { duration: 2000 });
        for (let i = 0; i < history.length; i++) {
            const loc = history[i];
            setAgents(prev => prev.map(a =>
                a.id === selectedAgent.id ? { ...a, lat: loc.lat, lng: loc.lng } : a
            ));
            await new Promise(r => setTimeout(r, 400));
        }
        setIsReplaying(false);
        toast.success('✅ Replay complete');
        fetchAgents(); // Restore real positions
    };



    // ─── ACTIONS ───────────────────────────────────────────────────────────────
    const handleAssignTask = async () => {
        if (!newTask.title) { toast.error('Please enter a task title'); return; }
        try {
            await toast.promise(
                apiFetch('/task', {
                    method: 'POST',
                    body: JSON.stringify({ agentId: selectedAgent.id, task: newTask.title, location: newTask.location, priority: newTask.priority })
                }),
                { loading: `Assigning task to ${selectedAgent?.name}...`, success: `Task assigned!`, error: (e) => e.message }
            );
            setTaskModal(false);
            setNewTask({ title: '', location: '', priority: 'Normal' });
        } catch { /* toast.promise handles it */ }
    };

    const handleGlobalDispatch = async () => {
        if (!dispatchData.title || !dispatchData.agentId) { toast.error('Select agent and enter task'); return; }
        try {
            await toast.promise(
                apiFetch('/task', {
                    method: 'POST',
                    body: JSON.stringify({ agentId: dispatchData.agentId, task: dispatchData.title, location: dispatchData.location, priority: dispatchData.priority })
                }),
                { loading: 'Dispatching...', success: 'Task dispatched!', error: (e) => e.message }
            );
            setDispatchModal(false);
            setDispatchData({ agentId: '', title: '', location: '', priority: 'Normal' });
        } catch { /* handled */ }
    };

    const handleAddAgent = async () => {
        if (!newAgentData.name || !newAgentData.phone) { toast.error('Name and phone required'); return; }
        try {
            await toast.promise(
                apiFetch('/agents', {
                    method: 'POST',
                    body: JSON.stringify(newAgentData)
                }),
                { loading: 'Adding agent...', success: 'Agent added!', error: (e) => e.message }
            );
            setAddAgentModal(false);
            setNewAgentData({ name: '', role: 'Fleet Driver', phone: '', vehicleNumber: '' });
        } catch { /* handled */ }
    };

    const handlePingSiren = async () => {
        try {
            await toast.promise(
                apiFetch('/siren', {
                    method: 'POST',
                    body: JSON.stringify({ agentId: selectedAgent.id, message: sirenMsg })
                }),
                {
                    loading: `Pinging ${selectedAgent?.name}...`,
                    success: `Emergency siren sent to ${selectedAgent?.name}!`,
                    error: (e) => e.message
                }
            );
            setSirenModal(false);
        } catch { /* handled */ }
    };

    const handleViewHistory = async () => {
        if (!selectedAgent) return;
        try {
            const res = await apiFetch(`/history/${selectedAgent.id}?hours=8`);
            setLocationHistory(res.data || []);
            setHistoryModal(true);
        } catch (err) {
            toast.error('Could not load history: ' + err.message);
        }
    };

    // ─── HELPERS ───────────────────────────────────────────────────────────────
    const getStatusColor = (status) => {
        if (status === 'In Transit' || status === 'Active') return '#10b981';
        if (status === 'Idle') return '#f59e0b';
        return '#94a3b8';
    };

    const getBatteryColor = (level) => {
        if (level > 50) return '#10b981';
        if (level > 20) return '#f59e0b';
        return '#ef4444';
    };

    const filteredAgents = agents.filter(a =>
        a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const mapCenter = [28.60, 77.20];

    // ─── MAP CONTROLLER ─────────────────────────────────────────────────────────
    function MapController({ selectedAgent }) {
        const map = useMap();
        useEffect(() => {
            if (selectedAgent?.lat) map.flyTo([selectedAgent.lat, selectedAgent.lng], 14, { duration: 1.5 });
        }, [selectedAgent, map]);
        return null;
    }

    const createCustomIcon = (agent, isSelected) => {
        const color = getStatusColor(agent.status);
        const roleEmojis = {
            'fleet driver':   '🚚',
            'doc collection': '🛵',
            'customs clerk':  '📋',
            'airport runner': '✈️',
        };
        const vehicleEmoji = roleEmojis[agent.role?.toLowerCase()] || '👤';
        return new L.divIcon({
            className: 'custom-leaflet-icon',
            html: `<div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%); width: 150px;">
                      <div style="background:${isSelected ? '#0f172a' : '#ffffff'}; color:${isSelected ? '#ffffff' : '#0f172a'}; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:700; white-space:nowrap; box-shadow:0 4px 6px rgba(0,0,0,0.1); border:${isSelected ? 'none' : '1px solid #cbd5e1'}; margin-bottom:4px; z-index:${isSelected ? '100' : '10'}; pointer-events: auto;">
                          ${agent.name}
                      </div>
                      <div style="width:28px; height:28px; background:${color}; border-radius:50%; border:3px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3); z-index:${isSelected ? '100' : '10'}; position:relative; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                         ${vehicleEmoji}
                         ${isSelected ? `<div style="position:absolute; inset:-8px; background:rgba(14,165,233,0.4); border-radius:50%; animation:ping 1.5s infinite"></div>` : ''}
                      </div>
                   </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
        });
    };
  return { MapController, addAgentModal, agents, createCustomIcon, dispatchData, dispatchModal, fetchAgents, fetchReport, filteredAgents, getBatteryColor, getStatusColor, handleAddAgent, handleAssignTask, handleGlobalDispatch, handlePingSiren, handleRouteReplay, handleViewHistory, historyModal, isReplaying, loading, locationHistory, mapCenter, newAgentData, newTask, reportData, reportDate, reportLoading, reportModal, searchQuery, selectedAgent, setAddAgentModal, setAgents, setDispatchData, setDispatchModal, setHistoryModal, setIsReplaying, setLoading, setLocationHistory, setNewAgentData, setNewTask, setReportData, setReportDate, setReportLoading, setReportModal, setSearchQuery, setSelectedAgent, setSirenModal, setSirenMsg, setTaskModal, sirenModal, sirenMsg, socketRef, taskModal };
}
