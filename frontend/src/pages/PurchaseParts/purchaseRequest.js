export const BLANK_REQUEST = {
  branch: 'Head Office', category: 'IT Assets', priority: 'NORMAL',
  itemName: '', itemDetails: '', amount: '', expectedDate: '',
  intendedUser: '', designation: '', department: '', justification: '',
};

const BRANCH_OPTIONS = ['Head Office', 'Delhi Branch', 'Mumbai Branch', 'Chennai Branch', 'Kolkata Branch'];
const CATEGORY_CHOICES = [
  { value: 'IT Assets', label: 'IT Assets (Laptops, Printers)' },
  { value: 'Office Supplies', label: 'Office Supplies' },
  { value: 'Warehouse Material', label: 'Warehouse Material' },
  { value: 'Vehicle Spares', label: 'Vehicle Spares' },
  { value: 'General Admin', label: 'General Admin' },
];
const PRIORITY_OPTIONS = [{ value: 'NORMAL', label: 'Normal' }, { value: 'URGENT', label: 'Urgent (Require immediately)' }];

const third = 'tw:md:col-span-2';
const full = 'tw:md:col-span-6';

export const REQUEST_FIELDS = [
  { name: 'branch', label: 'Branch', kind: 'select', options: BRANCH_OPTIONS, className: third },
  { name: 'category', label: 'Category', kind: 'select', options: CATEGORY_CHOICES, className: third },
  { name: 'priority', label: 'Priority', kind: 'select', options: PRIORITY_OPTIONS, className: third },
  { name: 'itemName', label: 'Item Name', required: true, placeholder: 'e.g. Dell Latitude Laptop', className: 'tw:md:col-span-4' },
  { name: 'amount', label: 'Estimated Amount (₹)', kind: 'number', required: true, placeholder: '55000', className: third },
  { name: 'itemDetails', label: 'Item Details / Specifications', kind: 'textarea', placeholder: 'i7 Processor, 16GB RAM, 512GB SSD...', className: full },
  { name: 'intendedUser', label: 'Intended User', required: true, placeholder: 'Employee Name', className: third },
  { name: 'designation', label: 'Designation', placeholder: 'e.g. Sales Executive', className: third },
  { name: 'department', label: 'Department', placeholder: 'e.g. Sales', className: third },
  { name: 'expectedDate', label: 'Expected Date of Delivery', kind: 'date', className: 'tw:md:col-span-3' },
  { name: 'justification', label: 'Reason / Justification for Purchase', kind: 'textarea', required: true, placeholder: 'Why is this purchase required? (e.g. New joining, old laptop damaged)', className: full },
];

export const missingRequiredField = (fields, values) => fields.find((field) => field.required && !values[field.name]);
