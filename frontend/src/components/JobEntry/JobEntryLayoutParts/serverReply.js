// The job / ICEGATE routes answer a refusal (stale job, duplicate invoice, failed checks) with an error status and a
// { success: false, error, ... } body. The screen reads that body like any other answer.
export async function serverReply(request) {
  try {
    return await request;
  } catch (error) {
    const body = error.response?.data;
    if (body && typeof body === 'object') return body;
    throw error;
  }
}
