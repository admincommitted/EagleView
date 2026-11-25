import { useEffect, useRef, useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import { itemFobFromInvoice } from '@/utils/exportFob';
import { perUnit } from '@/utils/cbicExchange';
import { formFromItem, invoiceSerialOf, renumberItems } from '../itemForm';

// the item list of the job: grid edits, drag to reorder, open / delete an item
export default function useItemList({
  items, setItems, exportData, remapItemRows, states, setFormData, selectedRowId, setSelectedRowId, formEdited, clearFormEdits, leaveFormOk,
}) {
  const gridContainerRef = useRef(null);
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState(null);

  useEffect(() => {
    if (gridContainerRef.current) gridContainerRef.current.scrollTop = gridContainerRef.current.scrollHeight;
  }, [items.length]);

  // item serial inside its invoice (each invoice counts from 1)
  const nextItemSr = (invSr, list = items, excludeId) => (
    list.filter((item) => invoiceSerialOf(item) === (parseInt(invSr, 10) || 1) && item.id !== excludeId).length + 1
  );

  // SW info / RoDTEP / statement rows of the job follow their items when items are deleted, moved or renumbered
  const putItems = (list) => {
    remapItemRows?.(items, list);
    setItems(list);
  };

  const handleDragStart = (event, index) => {
    setDraggedRowIndex(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', event.target);
    }
  };
  const handleDragEnd = () => {
    if (draggedRowIndex !== null && dragOverRowIndex !== null && draggedRowIndex !== dragOverRowIndex) {
      const reordered = [...items];
      const [dragged] = reordered.splice(draggedRowIndex, 1);
      reordered.splice(dragOverRowIndex, 0, dragged);
      setItems(reordered);
    }
    setDraggedRowIndex(null);
    setDragOverRowIndex(null);
  };

  // qty / price / unit keep both names in step; total and FOB (the item's share of the invoice FOB) follow
  const exchangeRateOf = (invSr) => {
    const invoice = (exportData?.invoices || [])[(parseInt(invSr, 10) || 1) - 1] || {};
    return perUnit(invoice.currency, invoice.exchRate || invoice.exchangeRate, invoice.unitInRs);
  };
  const updateItem = (id, field, value) => {
    setItems((previous) => previous.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value };
      if (field === 'price') next.rate = value;
      if (field === 'rate') next.price = value;
      if (field === 'uqc') {
        next.unit = value;
        if (!item.rateUnit || item.rateUnit === item.unit) next.rateUnit = value;
      }
      if (field === 'unit') next.uqc = value;
      if (['qty', 'price', 'rate'].includes(field)) {
        const total = (parseFloat(next.qty) || 0) * (parseFloat(next.rate ?? next.price) || 0) / (parseFloat(next.per) || 1);
        next.totalFc = total ? total.toFixed(2) : '';
        next.total = next.totalFc;
        const invoice = (exportData?.invoices || [])[invoiceSerialOf(next) - 1];
        const fobShare = invoice ? itemFobFromInvoice(next, invoice) : null;
        const rupeesPerUnit = exchangeRateOf(next.invSr);
        if (fobShare) next.itemFob = fobShare;
        else if (rupeesPerUnit && total) next.itemFob = (total * rupeesPerUnit).toFixed(2);
      }
      return next;
    }));
  };

  // a click on a row (or its pencil) opens the item in the form; changes in the form are asked about first, a click
  // on the item already open keeps them
  const openItem = async (item) => {
    if (item.id === selectedRowId && formEdited()) return;
    if (!(await leaveFormOk(`item ${item.itemSr || ''} of invoice ${item.invSr || 1} opens`))) return;
    clearFormEdits();
    setSelectedRowId(item.id);
    setFormData(formFromItem(item, exportData, states));
  };

  const deleteListedItem = async (item, index) => {
    const goAhead = await askConfirm({
      title: 'Delete item', message: `Delete item ${item.itemSr || index + 1} (${String(item.desc || '').slice(0, 40)})?`,
      okLabel: 'Delete', cancelLabel: 'Keep', tone: 'danger',
    });
    if (!goAhead) return;
    putItems(renumberItems(items.filter((other) => other.id !== item.id)));
    if (selectedRowId === item.id) setSelectedRowId(null);
  };

  return {
    gridContainerRef, draggedRowIndex, dragOverRowIndex, setDragOverRowIndex, handleDragStart, handleDragEnd,
    nextItemSr, putItems, updateItem, openItem, deleteListedItem,
  };
}
