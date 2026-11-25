// The server's answer also when it comes with an error status: these screens read { success, error } themselves.
export async function answerOf(request) {
  try {
    return await request;
  } catch (error) {
    if (error.response?.data !== undefined) return error.response.data;
    throw error;
  }
}
