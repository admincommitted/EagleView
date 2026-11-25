// Report routes answer { success, ..., error }. A failure (an error status or success: false) is thrown with the
// server's `error`, else "HTTP <status>"; a network failure keeps its own message.
export async function requestReport(request) {
  let body;
  try {
    body = await request();
  } catch (error) {
    if (!error.response) throw error;
    throw new Error(error.response.data?.error || `HTTP ${error.response.status}`);
  }
  if (body?.success === false) throw new Error(body.error || 'HTTP 200');
  return body || {};
}
