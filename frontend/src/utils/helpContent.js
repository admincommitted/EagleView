export const helpDocs = {
  dashboard: `
    <h3 style="font-family: Georgia, serif; font-size: 18px; text-transform: none; border-bottom: 1px dashed #4a3b32; padding-bottom: 5px;">Import Dashboard Guide</h3>
    <p><b>1. Live Tracking:</b> The dashboard automatically fetches real-time job statuses from the database every 30 seconds.</p>
    <p><b>2. Smart Filters:</b> Click on the filter chips (e.g., 'Queries Raised') to instantly filter the pipeline.</p>
    <p><b>3. WhatsApp Automation:</b> When a job reaches 'OOC' status, a green WhatsApp button appears on the card. Click it to notify the importer automatically.</p>
    <p><b>4. Global Search:</b> Press <b>Ctrl + K</b> anywhere in the software to instantly search across all Jobs, Invoices, and Containers.</p>
  `,
  header: `
    <h3 style="font-family: Georgia, serif; font-size: 18px; text-transform: none; border-bottom: 1px dashed #4a3b32; padding-bottom: 5px;">Job Header Guide</h3>
    <p><b>Ex-Bond Automation:</b> If you select BE Type 'X' (Ex-Bond), use the 'Select WH BE' button. It will auto-fetch all Invoices, Items, and available balances from the previous Into-Bond (Warehouse) job.</p>
    <p><b>Draft Save:</b> Clicking 'Save Draft' automatically saves the data into the database.</p>
  `,
  invoices: `
    <h3 style="font-family: Georgia, serif; font-size: 18px; text-transform: none; border-bottom: 1px dashed #4a3b32; padding-bottom: 5px;">Invoices Guide</h3>
    <p><b>Duty Recalculation:</b> Clicking 'Recalculate Duty for All' will pull the latest assessable values and duty rates from all attached items and update the invoice-level totals.</p>
  `,
  items: `
    <h3 style="font-family: Georgia, serif; font-size: 18px; text-transform: none; border-bottom: 1px dashed #4a3b32; padding-bottom: 5px;">Items & Single Window Guide</h3>
    <p><b>1. Auto-Duty Fetch:</b> Type an HS Code in the RITC box and click 'Fetch Item'. The system will auto-fill the Description, BCD, and IGST rates from the Customs Tariff Master.</p>
    <p><b>2. Auto-Calculations:</b> Quantity × Unit Price automatically calculates the Assessable Value. BCD Rate automatically generates the BCD Amount and SWS Amount.</p>
    <p><b>3. Single Window 'Apply to All':</b> Inside any Single Window popup (InfoType, Statement, etc.), click the 'Apply to All in Invoice' button to instantly copy that data to all other items in the same invoice.</p>
    <p><b>4. Multi-Sheet Excel Upload:</b> Click 'Download Template' to get a 6-sheet Excel file. Fill it out and upload it to map hundreds of items and their Single Window details in 1 second.</p>
  `,
  esanchit: `
    <h3 style="font-family: Georgia, serif; font-size: 18px; text-transform: none; border-bottom: 1px dashed #4a3b32; padding-bottom: 5px;">Supporting Docs Guide</h3>
    <p>Upload IRN or Doc codes here. They will map to the ICEGATE JSON payload under the SupportingDocs section.</p>
  `,
  reports: `
    <h3 style="font-family: Georgia, serif; font-size: 18px; text-transform: none; border-bottom: 1px dashed #4a3b32; padding-bottom: 5px;">Reports & Submission Guide</h3>
    <p><b>Checklist:</b> Review the 9-section checklist before submission.</p>
    <p><b>Excel Export:</b> Click Export to download a multi-sheet summary of the entire job.</p>
    <p><b>Submit to ICEGATE:</b> Ensure your DSC server is running on Port 5050. This button generates the strict ICEGATE JSON, signs it with your DSC Pin, and submits it to the live portal.</p>
  `
};
