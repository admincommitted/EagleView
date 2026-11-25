// The JSON the server answered with, also when it came with an error status: these routes say what went wrong in
// the body ({ success: false, message / error }), e.g. the Tariff master answers 404 for an RITC it does not have.
export default async function responseBody(request) {
  try {
    return await request;
  } catch (error) {
    const body = error.response?.data;
    if (body && typeof body === 'object') return body;
    throw error;
  }
}
