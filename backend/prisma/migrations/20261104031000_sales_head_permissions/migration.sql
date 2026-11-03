INSERT INTO security."RolePermission" ("roleId","permissionId")
SELECT r.id, p.id
FROM security."Role" r
CROSS JOIN security."Permission" p
WHERE r.code='SALES_HEAD'
  AND p.code IN (
    'account.profile.read','account.profile.update','catalog.product.read',
    'crm.customer.read','crm.customer.write','crm.contact.write','crm.partner.read','crm.activity.read',
    'order.read','order.accept','order.edit_noncritical','booking.read',
    'sales.lead.read','sales.lead.write','sales.opportunity.read','sales.opportunity.write',
    'sales.quote.read','sales.quote.write','sales.quote.approve','sales.sale.read','sales.sale.write',
    'sales.sale.complete','sales.kpi.read','sales.discount.grant','sales.checkout.read','sales.checkout.write',
    'finance.overview.read','finance.payment.read','finance.refund.read','finance.dispute.read','finance.invoice.read',
    'communication.read','communication.create','documents.read','support.read','support.case.read',
    'operational-notes.read','operational-notes.create','analytics.read','whatsapp.read','whatsapp.send',
    'request.load.read','request.load.read.department','request.assignment.read',
    'request.assignment.manage','request.assignment.reassign','request.assignment.self_assign','request.stats.read'
  )
ON CONFLICT DO NOTHING;
