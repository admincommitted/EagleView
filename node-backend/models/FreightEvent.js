const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

// Operational milestones on a freight shipment: console registration, cargo arrival notice,
// delivery order, de-stuffing, MBL / HBL issue, VGM, manifest.
//
// 30-Oct-2026: the three freight dashboards (Air Import, Sea Import, Sea Export) listed invented
// shipments (MBL "CMAU999888777" on "CMA CGM MARCO POLO V.42") and every action button on them was
// dead. These rows are what those buttons record.
//
// IMPORTANT, and said on the screen too: recording an IGM, VGM or AMS filing here is a record of
// what your office did. It does NOT transmit anything to ICEGATE / SCMTR, the shipping line's VGM
// portal or US customs - those need that system's own credentials and channel, which this software
// has not been given. Everything else here (console, CAN, D/O, de-stuffing, MBL / HBL) is internal
// paperwork and is complete.
const FreightEvent = sequelize.define('FreightEvent', {
    // which job this happened on; the job may be an import or an export job
    jobNo:      { type: DataTypes.STRING(40), allowNull: true },
    jobKind:    { type: DataTypes.STRING(10), allowNull: true },     // IMPORT / EXPORT
    jobId:      { type: DataTypes.INTEGER, allowNull: true },
    // CONSOLE / CAN / DO / DESTUFF / MBL / HBL / VGM / IGM / MANIFEST / AMS / OTHER
    eventType:  { type: DataTypes.STRING(20), allowNull: false },
    eventDate:  { type: DataTypes.DATEONLY, allowNull: false },
    // the document number this produced or refers to (D/O no, MBL no, VGM reference, IGM no ...)
    refNo:      { type: DataTypes.STRING(60), allowNull: true },
    // free detail: CFS name, weight declared, vessel, whatever the event needs
    detail:     { type: DataTypes.TEXT, allowNull: true },
    // true only for events that are purely internal. An IGM / VGM / AMS row is false, because this
    // software did not send it anywhere - it only recorded that someone did.
    isInternal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy:  { type: DataTypes.INTEGER, allowNull: true },
    createdByName: { type: DataTypes.STRING(150), allowNull: true },
}, { timestamps: true });

module.exports = FreightEvent;
