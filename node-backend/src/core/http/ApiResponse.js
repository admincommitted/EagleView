/**
 * Success answers. The frontend reads each endpoint's answer exactly as the old routes sent it (some send
 * { success, data }, some a plain array), so `send` writes the payload as given; the other helpers build the common
 * envelopes for new endpoints.
 */
export const ApiResponse = {
  send(res, payload, statusCode = 200) {
    return res.status(statusCode).json(payload);
  },

  success(res, data, message, statusCode = 200) {
    return res.status(statusCode).json({ success: true, ...(message && { message }), data });
  },

  created(res, data, message) {
    return ApiResponse.success(res, data, message, 201);
  },

  noContent(res) {
    return res.status(204).end();
  },
};
