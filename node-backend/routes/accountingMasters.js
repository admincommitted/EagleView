const TdsNature = require("../models/TdsNature");
const Currency = require("../models/Currency");
const express = require("express");
const router = express.Router();
const VoucherType = require("../models/VoucherType");
const CostCategory = require("../models/CostCategory");
const CostCentre = require("../models/CostCentre");

// Seed default Tally Masters
router.post("/seed", async (req, res) => {
  try {
    const vCount = await VoucherType.count();
    if (vCount === 0) {
      const vTypes = [
        { name: "Contra", baseType: "Contra", isBuiltIn: true },
        { name: "Payment", baseType: "Payment", isBuiltIn: true },
        { name: "Receipt", baseType: "Receipt", isBuiltIn: true },
        { name: "Journal", baseType: "Journal", isBuiltIn: true },
        { name: "Sales", baseType: "Sales", isBuiltIn: true },
        { name: "Purchase", baseType: "Purchase", isBuiltIn: true },
        { name: "Credit Note", baseType: "Credit Note", isBuiltIn: true },
        { name: "Debit Note", baseType: "Debit Note", isBuiltIn: true },
        { name: "Memo", baseType: "Memo", isBuiltIn: true },
        {
          name: "Reversing Journal",
          baseType: "Reversing Journal",
          isBuiltIn: true,
        },
        { name: "Sales Order", baseType: "Sales Order", isBuiltIn: true },
        { name: "Purchase Order", baseType: "Purchase Order", isBuiltIn: true },
        { name: "Delivery Note", baseType: "Delivery Note", isBuiltIn: true },
        { name: "Receipt Note", baseType: "Receipt Note", isBuiltIn: true },
        { name: "Physical Stock", baseType: "Physical Stock", isBuiltIn: true },
        { name: "Stock Journal", baseType: "Stock Journal", isBuiltIn: true },
        { name: "Material In", baseType: "Material In", isBuiltIn: true },
        { name: "Material Out", baseType: "Material Out", isBuiltIn: true },
        {
          name: "Job Work In Order",
          baseType: "Job Work In Order",
          isBuiltIn: true,
        },
        {
          name: "Job Work Out Order",
          baseType: "Job Work Out Order",
          isBuiltIn: true,
        },
      ];
      await VoucherType.bulkCreate(vTypes);
    }

    const cCount = await CostCategory.count();
    if (cCount === 0) {
      await CostCategory.create({
        name: "Primary Cost Category",
        allocateRevenue: true,
        allocateNonRevenue: false,
        isBuiltIn: true,
      });
    }

    res.json({ message: "Accounting Masters seeded successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const buildTree = (items, parentId = null) => {
  return items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      ...item.dataValues,
      children: buildTree(items, item.id),
    }));
};

router.get("/all", async (req, res) => {
  try {
    const vTypes = await VoucherType.findAll();
    const categories = await CostCategory.findAll();
    const centres = await CostCentre.findAll();

    res.json({
      success: true,
      data: {
        voucherTypes: vTypes,
        costCategories: categories,
        costCentresTree: buildTree(centres),
        costCentresFlat: centres,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/vouchertypes", async (req, res) => {
  try {
    const doc = await VoucherType.create(req.body);
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const doc = await CostCategory.create(req.body);
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/centres", async (req, res) => {
  try {
    const doc = await CostCentre.create(req.body);
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 30-Oct-2026: there was a stray 'module.exports = router;' here, with another 20 routes defined
// after it. It worked only because router is the same object, which is confusing to read. The single
// export is now at the bottom of the file where it belongs.

// Update Voucher Type
router.put("/vouchertypes/:id", async (req, res) => {
  try {
    await VoucherType.update(req.body, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete("/vouchertypes/:id", async (req, res) => {
  try {
    await VoucherType.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Category
router.put("/categories/:id", async (req, res) => {
  try {
    await CostCategory.update(req.body, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete("/categories/:id", async (req, res) => {
  try {
    await CostCategory.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Centre
router.put("/centres/:id", async (req, res) => {
  try {
    await CostCentre.update(req.body, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete("/centres/:id", async (req, res) => {
  try {
    await CostCentre.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Currency CRUD
router.get("/currencies", async (req, res) => {
  try {
    const curr = await Currency.findAll();
    res.json({ success: true, data: curr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/currencies", async (req, res) => {
  try {
    const curr = await Currency.create(req.body);
    res.json({ success: true, data: curr });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.put("/currencies/:id", async (req, res) => {
  try {
    await Currency.update(req.body, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete("/currencies/:id", async (req, res) => {
  try {
    await Currency.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// TDS Nature CRUD
router.get("/tds-natures", async (req, res) => {
  try {
    const items = await TdsNature.findAll();
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.post("/tds-natures", async (req, res) => {
  try {
    const item = await TdsNature.create(req.body);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.put("/tds-natures/:id", async (req, res) => {
  try {
    await TdsNature.update(req.body, { where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router.delete("/tds-natures/:id", async (req, res) => {
  try {
    await TdsNature.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/accounting-masters/cost-centre-report?from=&to=
// The Cost Centres screen printed invented allocations (Mumbai 3,00,000 /
// Delhi 2,00,000) from a hardcoded array. The real allocation is whatever the
// voucher lines were tagged with, so it is read from VoucherDetail.costCentreId.
// Centres with nothing booked show a dash rather than a number.
// Added 30-Oct-2026.
// ---------------------------------------------------------------------------
router.get("/cost-centre-report", async (req, res) => {
  try {
    const { Op } = require("sequelize");
    const Voucher = require("../models/Voucher");
    const VoucherDetail = require("../models/VoucherDetail");
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const from =
      req.query.from ||
      (new Date(to).getMonth() < 3
        ? new Date(to).getFullYear() - 1
        : new Date(to).getFullYear()) + "-04-01";

    const [categories, centres] = await Promise.all([
      CostCategory.findAll(),
      CostCentre.findAll(),
    ]);
    const vouchers = await Voucher.findAll({
      where: { date: { [Op.between]: [from, to] } },
      attributes: ["id"],
    });
    const vIds = vouchers.map((v) => v.id);
    const lines = vIds.length
      ? await VoucherDetail.findAll({
          where: {
            voucherId: { [Op.in]: vIds },
            costCentreId: { [Op.ne]: null },
          },
        })
      : [];

    // Dr on a cost centre is spend against it, Cr is a credit back to it
    const byCentre = new Map();
    let tagged = 0;
    lines.forEach((l) => {
      const amt = (parseFloat(l.amount) || 0) * (l.dc === "Dr" ? 1 : -1);
      byCentre.set(l.costCentreId, (byCentre.get(l.costCentreId) || 0) + amt);
      tagged++;
    });
    const r2 = (n) => Math.round(n * 100) / 100;
    // a centre's own amount plus everything under it
    const kidsOf = (id) => centres.filter((c) => c.parentId === id);
    const totalOf = (c) =>
      r2(
        (byCentre.get(c.id) || 0) +
          kidsOf(c.id).reduce((a, k) => a + totalOf(k), 0),
      );
    const nodeOf = (c) => ({
      id: "cc" + c.id,
      centreId: c.id,
      name: c.name,
      type: "centre",
      amount: totalOf(c),
      children: kidsOf(c.id).map(nodeOf),
    });

    const data = categories.map((cat) => {
      const roots = centres.filter(
        (c) => c.categoryId === cat.id && !c.parentId,
      );
      const children = roots.map(nodeOf);
      return {
        id: "cat" + cat.id,
        categoryId: cat.id,
        name: cat.name,
        type: "category",
        amount: r2(children.reduce((a, c) => a + c.amount, 0)),
        children,
      };
    });
    const loose = centres.filter((c) => !c.categoryId && !c.parentId);
    if (loose.length) {
      const children = loose.map(nodeOf);
      data.push({
        id: "cat0",
        categoryId: null,
        name: "Not in any category",
        type: "category",
        amount: r2(children.reduce((a, c) => a + c.amount, 0)),
        children,
      });
    }
    // money on vouchers that nobody tagged - the gap between this report and the books
    const untaggedLines = vIds.length
      ? await VoucherDetail.count({
          where: { voucherId: { [Op.in]: vIds }, costCentreId: null },
        })
      : 0;
    res.json({
      success: true,
      from,
      to,
      data,
      counts: {
        categories: categories.length,
        centres: centres.length,
        taggedLines: tagged,
        untaggedLines,
      },
      note: centres.length
        ? "Amounts are the voucher lines tagged to each centre. " +
          untaggedLines +
          " line(s) in this period carry no cost centre, so they are not in any figure above."
        : "No cost centres exist yet. Add a category and a centre, then tag voucher lines with them on Voucher Entry.",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
