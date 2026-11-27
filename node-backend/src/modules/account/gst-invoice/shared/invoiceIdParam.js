/**
 * `/:id` is an invoice id only when it is a number; anything else goes on to the named routes
 * (Express 5 paths have no '(\\d+)'). Registered on every GST invoice router that has an `:id` path.
 */
export const onlyNumericInvoiceId = (router) => {
  router.param('id', (req, res, next, id) => (/^\d+$/.test(String(id)) ? next() : next('route')));
  return router;
};
