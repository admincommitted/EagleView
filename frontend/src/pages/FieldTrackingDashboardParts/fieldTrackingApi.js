import axiosInstance from '@/services/axiosInstance';

// an error status carries { error } with the server's message
async function request(config) {
  try {
    return (await axiosInstance.request({ ...config, url: '/field-tracking' + config.url })).data;
  } catch (error) {
    if (!error.response) throw error;
    throw new Error(error.response.data?.error || 'Request failed');
  }
}

export const fieldTrackingApi = {
  agents: () => request({ method: 'get', url: '/agents' }),
  addAgent: (agent) => request({ method: 'post', url: '/agents', data: agent }),
  completeTask: (agentId) => request({ method: 'patch', url: `/agents/${agentId}/task-complete` }),
  disconnectPhone: (agentId) => request({ method: 'post', url: `/agents/${encodeURIComponent(agentId)}/disconnect` }),
  assignTask: (task) => request({ method: 'post', url: '/task', data: task }),
  siren: (alert) => request({ method: 'post', url: '/siren', data: alert }),
  history: (agentId, hours) => request({ method: 'get', url: `/history/${agentId}`, params: hours ? { hours } : undefined }),
  dailyReport: (date) => request({ method: 'get', url: '/report/summary', params: { date } }),
  publicUrl: () => request({ method: 'get', url: '/public-url' }),
  deviceSettings: () => request({ method: 'get', url: '/device/settings' }),
  saveDeviceSettings: (settings) => request({ method: 'put', url: '/device/settings', data: settings }),
};
