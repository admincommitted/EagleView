const express = require('express');
const router = express.Router();
const EmployeeMaster = require('../models/EmployeeMaster');
const AttendanceLog = require('../models/AttendanceLog');
const LeaveRequest = require('../models/LeaveRequest');
const HRAuditLog = require('../models/HRAuditLog');

// 1. GET /api/hr/employees
router.get('/employees', async (req, res) => {
    try {
        const employees = await EmployeeMaster.findAll();
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. GET /api/hr/attendance
// Example usage: /api/hr/attendance?month=2026-09
router.get('/attendance', async (req, res) => {
    try {
        const { month } = req.query;
        let whereClause = {};
        
        // Very simple prefix matching for month (e.g. '2026-09')
        // In SQLite/MySQL date format is usually YYYY-MM-DD
        if (month) {
            const { Op } = require('sequelize');
            whereClause.date = {
                [Op.like]: `${month}-%`
            };
        }

        const logs = await AttendanceLog.findAll({ where: whereClause });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. POST /api/hr/attendance/punch
router.post('/attendance/punch', async (req, res) => {
    try {
        const { employeeId, date, time, type, location, photoUrl } = req.body;
        // Find existing record for this date
        let log = await AttendanceLog.findOne({ where: { employeeId, date } });
        
        if (!log) {
            log = await AttendanceLog.create({
                employeeId,
                date,
                status: 'P', // default to Present if punching
                allPunches: []
            });
        }

        // Save history of all punches
        let punches = log.allPunches || [];
        punches.push({ time, type, location, photoUrl });
        log.allPunches = punches;

        // FIRST IN, LAST OUT (FILO) Logic
        if (!log.punchIn) {
            // First ever punch of the day becomes Punch IN
            log.punchIn = time;
            log.punchInLocation = location;
            log.punchInPhotoUrl = photoUrl;
        } else {
            // Any subsequent punch (2nd, 3rd, 4th, 5th) becomes Punch OUT
            log.punchOut = time;
            log.punchOutLocation = location;
            log.punchOutPhotoUrl = photoUrl;
        }

        await log.save();
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. GET /api/hr/leaves
router.get('/leaves', async (req, res) => {
    try {
        const leaves = await LeaveRequest.findAll();
        res.json(leaves);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. POST /api/hr/leaves
router.post('/leaves', async (req, res) => {
    try {
        const { employeeId, type, startDate, endDate, reason } = req.body;
        const leave = await LeaveRequest.create({
            employeeId, type, startDate, endDate, reason
        });
        
        await HRAuditLog.create({
            actionType: 'CREATE_LEAVE_REQUEST',
            employeeId,
            details: leave.toJSON()
        });
        
        res.json(leave);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. PUT /api/hr/leaves/:id/status
router.put('/leaves/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, managerNotes } = req.body;
        
        const leave = await LeaveRequest.findByPk(id);
        if (!leave) return res.status(404).json({ error: 'Not found' });
        
        leave.status = status;
        if (managerNotes) leave.managerNotes = managerNotes;
        await leave.save();
        
        await HRAuditLog.create({
            actionType: 'UPDATE_LEAVE_STATUS',
            employeeId: leave.employeeId,
            details: { status, managerNotes }
        });
        
        res.json(leave);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
