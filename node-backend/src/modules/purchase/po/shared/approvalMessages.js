import { actionLink } from './approvalLinks.js';

// The texts of the approval request (e-mail / WhatsApp) to the director and the page an approval link opens.

const ITEMS_TABLE_HEAD = `
            <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: left;">Item Name</th>
                          <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: left;">Last Purchase</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: center;">Qty</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: right;">Unit Price (Rs)</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: center;">GST %</th>
                        <th style="padding: 8px 10px; border-bottom: 2px solid #94a3b8; background-color: #f1f5f9; font-family: Arial, sans-serif; font-size: 13px; color: #334155; text-align: right;">Total (Rs)</th>
                    </tr>
                </thead>
                <tbody>
        `;

export const FIRST_TIME_BUY_HTML = '<span style="color: #94a3b8; font-size: 11px;">First Time Buy</span>';

export const lastPurchaseHtml = (lastPurchase) =>
  `<span style="color: #475569; font-size: 11px;">Rs.${lastPurchase.unitPrice} on ${new Date(lastPurchase.PurchaseOrder.createdAt).toLocaleDateString()}<br/>(${lastPurchase.PurchaseOrder.poNumber})</span>`;

export const approvalItemRowHtml = ({ item, lastPurchaseText, rowBackground, lineTotal }) => `
                <tr style="background-color: ${rowBackground};">
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a;">${item.itemName}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a;">${lastPurchaseText}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: center;">${item.quantity}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: right;">${Number(item.unitPrice).toFixed(2)}</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: center;">${item.gstRate || 0}%</td>
                    <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; text-align: right;">${lineTotal.toFixed(2)}</td>
                </tr>
            `;

const itemsTableFootHtml = (po) => `
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" style="padding: 8px 10px; text-align: right; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #1e293b; background-color: #f1f5f9;">Grand Total:</td>
                        <td style="padding: 8px 10px; text-align: right; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #16a34a; background-color: #f1f5f9;">Rs. ${Number(po.totalAmount).toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
        `;

export const approvalItemsTableHtml = (rowsHtml, po) => ITEMS_TABLE_HEAD + rowsHtml + itemsTableFootHtml(po);

export const approvalMailHtml = ({ po, vendor, itemsHtml, backendUrl, directorEmail, frontendUrl }) => `
                <div style="font-family: Arial, sans-serif; background-color: #f1f5f9; padding: 30px 10px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <tr>
                            <td style="background-color: #1e3a8a; padding: 20px; border-bottom: 4px solid #3b82f6;">
                                <table width="100%">
                                    <tr>
                                        <td>
                                            <h2 style="margin: 0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 22px; color: #ffffff; letter-spacing: 0.5px;">Purchase Order Approval</h2>
                                            <p style="margin: 6px 0 0 0; font-size: 14px; color: #bfdbfe; font-family: 'Segoe UI', Arial, sans-serif;">Please review the following request.</p>
                                        </td>
                                        <td align="right" valign="middle">
                                            <table border="0" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center" bgcolor="#f59e0b" style="border-radius: 20px; padding: 6px 14px;">
                                                        <span style="color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: bold; letter-spacing: 1px;">PENDING</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 25px 25px 5px 25px;">
                                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; font-family: Arial, sans-serif; font-size: 13px; color: #334155; line-height: 1.6;">
                                    <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; text-transform: uppercase;">Issuing Company Details</h4>
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td width="100" valign="top"><strong>Name</strong></td>
                                            <td width="10" valign="top">:</td>
                                            <td valign="top"><strong>COMMITTED CARGO CARE LIMITED</strong></td>
                                        </tr>
                                        <tr>
                                            <td valign="top"><strong>Address</strong></td>
                                            <td valign="top">:</td>
                                            <td valign="top">A-406, ROAD NO-4, STREET NO. 8, MAHIPALPUR EXTN., New Delhi-110037</td>
                                        </tr>
                                        <tr>
                                            <td valign="top"><strong>GSTIN</strong></td>
                                            <td valign="top">:</td>
                                            <td valign="top">07AAACC6689E1ZJ</td>
                                        </tr>
                                        <tr>
                                            <td valign="top"><strong>State</strong></td>
                                            <td valign="top">:</td>
                                            <td valign="top">Delhi <span style="margin-left: 20px;"><strong>State Code :</strong> 07</span></td>
                                        </tr>
                                    </table>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 25px 25px 25px;">
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 6px;">
                                    <tr>
                                        <td width="50%" valign="top" style="padding: 15px; border-right: 1px solid #e2e8f0; font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.8;">
                                            <strong style="color: #0f172a;">PO Number:</strong> ${po.poNumber}<br>
                                            <strong style="color: #0f172a;">Date:</strong> ${new Date().toLocaleDateString()}<br>
                                            <strong style="color: #0f172a;">Branch:</strong> ${po.branch}<br>
                                        </td>
                                        <td width="50%" valign="top" style="padding: 15px; font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.8;">
                                            <strong style="color: #0f172a;">Vendor:</strong> ${vendor ? vendor.vendorName : 'N/A'}<br>
                                            <strong style="color: #0f172a;">Category:</strong> ${po.category}<br>
                                            <strong style="color: #0f172a;">Priority:</strong> <span style="color: ${po.priority === 'High' ? '#ef4444' : '#3b82f6'}; font-weight: bold;">${po.priority || 'Normal'}</span><br>
                                        </td>
                                    </tr>
                                </table>

                                <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-bottom: 25px; border-radius: 4px; font-family: Arial, sans-serif; font-size: 13px; color: #92400e;">
                                    <strong style="display: block; margin-bottom: 4px; color: #b45309;">Remarks:</strong> 
                                    ${po.justification || 'No remarks provided.'}
                                    
                                </div>

                                <h3 style="font-family: Arial, sans-serif; font-size: 15px; color: #0f172a; margin-top: 0; margin-bottom: 10px;">Itemized Details</h3>
                                ${itemsHtml}

                                
                                <div style="margin-top: 25px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 6px; background-color: #ffffff; font-family: Arial, sans-serif; font-size: 12px; color: #475569; line-height: 1.6;">
                                    <h4 style="margin: 0 0 10px 0; color: #0f172a; font-size: 14px;">TERMS & CONDITIONS</h4>
                                    <ul style="margin: 0; padding-left: 20px;">
                                        <li style="margin-bottom: 6px;"><strong>GST & INVOICING:</strong> VALID GSTIN AND PROPER HSN/SAC CODES ARE MANDATORY ON THE FINAL INVOICE.</li>
                                        <li style="margin-bottom: 6px;"><strong>DELIVERY:</strong> MATERIALS MUST BE DELIVERED TO THE COMMITTED CARGO CARE LIMITED, MAHIPALPUR OFFICE DURING STANDARD WORKING HOURS.</li>
                                        <li style="margin-bottom: 6px;"><strong>PAYMENT TERMS:</strong> PAYMENT WILL BE PROCESSED UPON SUCCESSFUL MATERIAL VERIFICATION AND INVOICE SUBMISSION, SUBJECT TO AGREED CREDIT TERMS.</li>
                                        <li><strong>REJECTIONS:</strong> DEFECTIVE OR NON-COMPLIANT ITEMS WILL BE REJECTED; RETURN FREIGHT WILL BE BORNE BY THE VENDOR.</li>
                                    </ul>
                                    <div style="font-size: 11px; color: #64748b; margin-top: 15px; font-style: italic; font-weight: bold; text-transform: uppercase;">* NOTE: ALL DISPUTES ARE SUBJECT TO DELHI JURISDICTION ONLY.</div>
                                </div>

                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 25px 15px; text-align: center;">
                                    <tr>
                                        <td style="font-family: Arial, sans-serif; padding-bottom: 15px;">
                                            <strong style="font-size: 15px; color: #0f172a;">Take Action</strong>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center">
                                            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                                                <tr>
                                                    <td align="center" bgcolor="#10b981" style="border-radius: 6px; padding: 12px 28px;">
                                                        <a href="${actionLink(backendUrl, po.id, 'Approve', directorEmail)}" target="_blank" style="font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; text-decoration: none; display: block; font-weight: bold;"><font color="#ffffff">Approve</font></a>
                                                    </td>
                                                    <td width="15" style="width: 15px;">&nbsp;</td>
                                                    <td align="center" bgcolor="#ef4444" style="border-radius: 6px; padding: 12px 28px;">
                                                        <a href="${actionLink(backendUrl, po.id, 'Reject', directorEmail)}" target="_blank" style="font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; text-decoration: none; display: block; font-weight: bold;"><font color="#ffffff">Reject</font></a>
                                                    </td>
                                                    <td width="15" style="width: 15px;">&nbsp;</td>
                                                    <td align="center" bgcolor="#f59e0b" style="border-radius: 6px; padding: 12px 28px;">
                                                        <a href="${actionLink(backendUrl, po.id, 'Hold', directorEmail)}" target="_blank" style="font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif; color: #ffffff; text-decoration: none; display: block; font-weight: bold;"><font color="#ffffff">Hold</font></a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <div style="margin-top: 25px; text-align: center; font-family: Arial, sans-serif; font-size: 13px;">
                                    <a href="${frontendUrl}" style="color: #2563eb; text-decoration: none; font-weight: bold;">View PO in EagleView ERP Portal &rarr;</a>
                                </div>
                            </td>
                        </tr>
                    </table>
                    <p style="text-align: center; font-family: Arial, sans-serif; font-size: 11px; color: #94a3b8; margin-top: 15px;">
                        This is an automated message from EagleView ERP. Please do not reply.
                    </p>
                </div>
            `;

export const approvalWhatsappItemLine = (item) =>
  `▫️ *${item.itemName}* (Qty: ${item.quantity} @ ₹${Number(item.unitPrice).toFixed(2)})`;

export const approvalWhatsappText = ({ po, vendor, itemsString, backendUrl, directorPhone }) =>
  `*⚠️ PURCHASE ORDER APPROVAL ⚠️*\n\n*📌 PO Number:* ${po.poNumber}\n*🏢 Vendor:* ${vendor ? vendor.vendorName : 'N/A'}\n*💰 Total Amount:* ₹${Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n*📝 Remarks:* ${po.justification || 'N/A'}\n\n*📦 ORDER ITEMS:*\n${itemsString}\n\n--------------------------------------\n*⚡ ACTION REQUIRED*\n\n✅ *To APPROVE this PO:*\n👉 ${actionLink(backendUrl, po.id, 'Approve', directorPhone)}\n\n❌ *To REJECT this PO:*\n👉 ${actionLink(backendUrl, po.id, 'Reject', directorPhone)}\n--------------------------------------`;

export const alreadyDecidedText = (po) => `PO ${po.poNumber} is already ${po.status}. No change made.`;

export const actionResultPage = (po, action) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PO ${po.status}</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f3f4f6; height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { background: white; padding: 40px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); text-align: center; max-width: 400px; width: 90%; margin: 20px; }
        .icon-container { width: 90px; height: 90px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .success { background-color: #dcfce7; color: #15803d; border: 4px solid #bbf7d0; }
        .error { background-color: #fee2e2; color: #b91c1c; border: 4px solid #fecaca; }
        .icon { font-size: 45px; font-weight: bold; }
        h1 { margin: 0 0 12px 0; color: #111827; font-size: 26px; }
        p { color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px; }
        .po-badge { display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; padding: 8px 16px; border-radius: 30px; font-weight: 700; font-size: 15px; margin-bottom: 24px; letter-spacing: 0.5px; box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02); }
        .footer-text { font-size: 14px; color: #9ca3af; margin-bottom: 0; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-container ${action === 'Approve' ? 'success' : 'error'} pulse">
            <span class="icon">${action === 'Approve' ? '?' : '?'}</span>
        </div>
        <h1>PO ${po.status}</h1>
        <div class="po-badge">${po.poNumber}</div>
        <p>Your action has been <b>successfully</b> recorded in the EagleView ERP system. The procurement team has been notified.</p>
        <p class="footer-text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
            You can safely close this window
        </p>
    </div>
</body>
</html>
`;

export const resendItemsTableHtml = (items) =>
  `<table width="100%" border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;">
            <tr><th>Item Name</th><th>Qty</th><th>Unit Price (Rs)</th><th>Total (Rs)</th></tr>` +
  items
    .map(
      (item) =>
        `<tr><td>${item.itemName}</td><td>${item.quantity}</td><td>${item.unitPrice}</td><td>${(Number(item.quantity) * Number(item.unitPrice) + Number(item.gstAmount || 0)).toFixed(2)}</td></tr>`,
    )
    .join('') +
  `</table>`;

export const resendMailHtml = ({ po, itemsHtml, base, directorEmail }) => `<h3>Purchase Order Approval (RESEND)</h3>
                   <p><strong>PO Number:</strong> ${po.poNumber}</p>
                   <p><strong>Vendor:</strong> ${po.Vendor ? po.Vendor.vendorName : 'N/A'}</p>
                   <p><strong>Total Amount:</strong> Rs. ${po.totalAmount}</p>
                   ${itemsHtml}
                   <br/>
                   <p>
                   <a href="${actionLink(base, po.id, 'Approve', directorEmail)}" style="padding: 10px 15px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin-right: 8px;">Approve</a>
                   <a href="${actionLink(base, po.id, 'Reject', directorEmail)}" style="padding: 10px 15px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin-right: 8px;">Reject</a>
                   <a href="${actionLink(base, po.id, 'Hold', directorEmail)}" style="padding: 10px 15px; background: #d97706; color: white; text-decoration: none; border-radius: 5px;">Hold</a>
                   </p>`;

export const resendWhatsappItemLine = (item) =>
  `\uD83D\uDCE6 *${item.itemName}*\n  + Qty: ${item.quantity} | Rate: \u20B9${Number(item.unitPrice).toFixed(2)}`;

// these two links carry no signature, so the approval page refuses them
export const resendWhatsappText = ({ po, itemLines, origin, directorPhone }) =>
  `\uD83D\uDEA8 *[RESEND] PURCHASE ORDER APPROVAL* \uD83D\uDEA8\n\n\uD83D\uDCCC *PO Number:* ${po.poNumber}\n\uD83C\uDFE2 *Vendor:* ${po.Vendor ? po.Vendor.vendorName : 'N/A'}\n\uD83D\uDCB0 *Total Amount:* \u20B9${Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n*\uD83D\uDCE6 Items Requested:*\n${itemLines}\n\n--------------------------------------\n*\u26A1 ACTION REQUIRED*\n\n\u2705 *To APPROVE this PO:*\n\uD83D\uDC49 ${origin}/api/po/${po.id}/action?action=Approve&by=${encodeURIComponent(directorPhone)}\n\n\u274C *To REJECT this PO:*\n\uD83D\uDC49 ${origin}/api/po/${po.id}/action?action=Reject&by=${encodeURIComponent(directorPhone)}\n--------------------------------------`;
